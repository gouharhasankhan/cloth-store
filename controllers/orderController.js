// controllers/orderController.js - With Razorpay + Settings + Coupons

const db = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ── Delivery charge calculate karo settings se ──
async function calcDelivery(subtotal) {
  const charge = parseFloat(await db.getSetting('delivery_charge') || 50);
  const freeAbove = parseFloat(await db.getSetting('free_delivery_above') || 500);
  return subtotal >= freeAbove ? 0 : charge;
}

// ── Coupon validate karo ──
async function validateCoupon(code, userId, subtotal) {
  const [rows] = await db.query(
    `SELECT * FROM coupons WHERE code = ? AND is_active = 1`, [code]
  );
  if (rows.length === 0) return { valid: false, msg: 'Invalid coupon code' };
  const c = rows[0];

  if (c.expires_at && new Date(c.expires_at) < new Date())
    return { valid: false, msg: 'Coupon expired ho gaya' };
  if (c.max_uses && c.used_count >= c.max_uses)
    return { valid: false, msg: 'Coupon ki limit khatam ho gayi' };
  if (subtotal < c.min_order)
    return { valid: false, msg: `Minimum order ₹${c.min_order} chahiye` };

  if (c.once_per_user) {
    const [used] = await db.query(
      'SELECT id FROM coupon_uses WHERE coupon_id=? AND user_id=?', [c.id, userId]
    );
    if (used.length > 0) return { valid: false, msg: 'Aap pehle ye coupon use kar chuke hain' };
  }

  const discount = c.type === 'percent'
    ? Math.round(subtotal * c.value / 100)
    : Math.min(c.value, subtotal);

  return { valid: true, coupon: c, discount };
}


// ========================
// GET CHECKOUT PAGE
// ========================
exports.getCheckout = async (req, res) => {
  try {
    const [items] = await db.query(
      `SELECT c.*, p.name, p.price, p.discount_price, p.image
       FROM cart c JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [req.session.user.id]
    );
    if (items.length === 0) {
      req.flash('error', 'Your cart is empty');
      return res.redirect('/cart');
    }

    let subtotal = 0;
    items.forEach(i => { subtotal += (i.discount_price || i.price) * i.quantity; });

    const deliveryCharge = await calcDelivery(subtotal);
    const freeAbove = await db.getSetting('free_delivery_above') || 500;
    const codEnabled = (await db.getSetting('cod_enabled')) === '1';
    const razorpayEnabled = (await db.getSetting('razorpay_enabled')) === '1';
    const estimatedDays = await db.getSetting('estimated_delivery_days') || '3-5';

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);

    // First order discount
    const firstOrderDiscount = (await db.getSetting('first_order_discount')) === '1';
    let firstOrderAmt = 0;
    if (firstOrderDiscount) {
      const [prev] = await db.query(
        `SELECT id FROM orders WHERE user_id = ? AND payment_status = 'paid' LIMIT 1`,
        [req.session.user.id]
      );
      if (prev.length === 0) {
        firstOrderAmt = parseFloat(await db.getSetting('first_order_discount_value') || 0);
      }
    }

    res.render('orders/checkout', {
      title: 'Checkout',
      items, subtotal, deliveryCharge, freeAbove,
      codEnabled, razorpayEnabled, estimatedDays,
      firstOrderAmt,
      profile: users[0],
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.redirect('/cart');
  }
};


// ========================
// APPLY COUPON (AJAX)
// ========================
exports.applyCoupon = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const result = await validateCoupon(code, req.session.user.id, parseFloat(subtotal));
    if (!result.valid) return res.json({ success: false, message: result.msg });
    res.json({ success: true, discount: result.discount, type: result.coupon.type, value: result.coupon.value });
  } catch (err) {
    res.json({ success: false, message: 'Error checking coupon' });
  }
};


// ── Common order validation ──
async function validateOrder(userId, items, paymentMethod) {
  const minOrder = parseFloat(await db.getSetting('min_order_amount') || 0);
  const maxItems = parseInt(await db.getSetting('max_items_per_order') || 20);
  const codEnabled = (await db.getSetting('cod_enabled')) === '1';
  const razorpayEnabled = (await db.getSetting('razorpay_enabled')) === '1';

  let subtotal = 0, totalQty = 0;
  items.forEach(i => {
    subtotal += (i.discount_price || i.price) * i.quantity;
    totalQty += i.quantity;
  });

  if (minOrder > 0 && subtotal < minOrder)
    return { ok: false, msg: `Minimum order amount ₹${minOrder} hai` };
  if (totalQty > maxItems)
    return { ok: false, msg: `Ek order mein maximum ${maxItems} items allowed hain` };
  if (paymentMethod === 'COD' && !codEnabled)
    return { ok: false, msg: 'Cash on Delivery filhaal available nahi hai' };
  if (paymentMethod === 'Razorpay' && !razorpayEnabled)
    return { ok: false, msg: 'Online payment filhaal available nahi hai' };

  for (const item of items) {
    if (item.quantity > item.stock)
      return { ok: false, msg: `"${item.name}" ka stock available nahi` };
  }

  return { ok: true, subtotal };
}


// ========================
// PLACE ORDER (COD)
// ========================
exports.placeOrder = async (req, res) => {
  try {
    const { shipping_address, payment_method, coupon_code } = req.body;
    const userId = req.session.user.id;

    const [items] = await db.query(
      `SELECT c.*, p.price, p.discount_price, p.stock, p.name
       FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`,
      [userId]
    );
    if (items.length === 0) {
      req.flash('error', 'Cart khali hai'); return res.redirect('/cart');
    }

    const check = await validateOrder(userId, items, payment_method || 'COD');
    if (!check.ok) { req.flash('error', check.msg); return res.redirect('/cart'); }

    const subtotal = check.subtotal;
    const delivery = await calcDelivery(subtotal);

    // Coupon
    let discountAmt = 0, validCoupon = null;
    if (coupon_code && coupon_code.trim()) {
      const cr = await validateCoupon(coupon_code.trim().toUpperCase(), userId, subtotal);
      if (cr.valid) { discountAmt = cr.discount; validCoupon = cr.coupon; }
    }

    // First order discount
    const firstOrderDiscount = (await db.getSetting('first_order_discount')) === '1';
    if (firstOrderDiscount && !validCoupon) {
      const [prev] = await db.query(
        `SELECT id FROM orders WHERE user_id = ? AND payment_status = 'paid' LIMIT 1`, [userId]
      );
      if (prev.length === 0)
        discountAmt = parseFloat(await db.getSetting('first_order_discount_value') || 0);
    }

    const total = Math.max(0, subtotal + delivery - discountAmt);

    const [result] = await db.query(
      `INSERT INTO orders (user_id,total_amount,payment_method,payment_status,shipping_address,coupon_code,discount_amount)
       VALUES (?,?,'COD','pending',?,?,?)`,
      [userId, total, shipping_address, coupon_code || null, discountAmt]
    );
    const orderId = result.insertId;

    for (const item of items) {
      const price = item.discount_price || item.price;
      await db.query(
        `INSERT INTO order_items (order_id,product_id,quantity,price,size,color) VALUES (?,?,?,?,?,?)`,
        [orderId, item.product_id, item.quantity, price, item.size, item.color]
      );
      await db.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    if (validCoupon) {
      await db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [validCoupon.id]);
      await db.query('INSERT INTO coupon_uses (coupon_id,user_id,order_id) VALUES (?,?,?)', [validCoupon.id, userId, orderId]);
    }

    await db.query('DELETE FROM cart WHERE user_id = ?', [userId]);
    req.flash('success', `Order placed! Order ID: #${orderId}`);
    return res.redirect(`/orders/${orderId}`);
  } catch (err) {
    console.error('Place order error:', err);
    req.flash('error', 'Order place nahi ho saka');
    return res.redirect('/cart');
  }
};


// ========================
// CREATE RAZORPAY ORDER
// ========================
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { shipping_address, coupon_code } = req.body;
    const userId = req.session.user.id;

    if (!shipping_address?.trim())
      return res.status(400).json({ success: false, message: 'Shipping address required hai' });

    const [items] = await db.query(
      `SELECT c.*, p.price, p.discount_price, p.stock, p.name
       FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`,
      [userId]
    );
    if (items.length === 0)
      return res.status(400).json({ success: false, message: 'Cart khali hai' });

    const check = await validateOrder(userId, items, 'Razorpay');
    if (!check.ok) return res.status(400).json({ success: false, message: check.msg });

    const subtotal = check.subtotal;
    const delivery = await calcDelivery(subtotal);

    let discountAmt = 0, validCoupon = null;
    if (coupon_code?.trim()) {
      const cr = await validateCoupon(coupon_code.trim().toUpperCase(), userId, subtotal);
      if (cr.valid) { discountAmt = cr.discount; validCoupon = cr.coupon; }
    }

    const firstOrderDiscount = (await db.getSetting('first_order_discount')) === '1';
    if (firstOrderDiscount && !validCoupon) {
      const [prev] = await db.query(
        `SELECT id FROM orders WHERE user_id = ? AND payment_status = 'paid' LIMIT 1`, [userId]
      );
      if (prev.length === 0)
        discountAmt = parseFloat(await db.getSetting('first_order_discount_value') || 0);
    }

    const total = Math.max(1, subtotal + delivery - discountAmt);

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: { user_id: userId, shipping_address: shipping_address.substring(0, 200) }
    });

    const [result] = await db.query(
      `INSERT INTO orders (user_id,total_amount,payment_method,payment_status,razorpay_order_id,shipping_address,coupon_code,discount_amount)
       VALUES (?,?,'Razorpay','pending',?,?,?,?)`,
      [userId, total, razorpayOrder.id, shipping_address, coupon_code || null, discountAmt]
    );

    const [user] = await db.query('SELECT name, email, phone FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      order_db_id: result.insertId,
      coupon_id: validCoupon?.id || null,
      user: user[0]
    });
  } catch (err) {
    console.error('Razorpay order create error:', err);
    res.status(500).json({ success: false, message: 'Payment order create nahi ho saka' });
  }
};


// ========================
// VERIFY RAZORPAY PAYMENT
// ========================
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_db_id, coupon_id } = req.body;
    const userId = req.session.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await db.query(
        `UPDATE orders SET payment_status='failed',status='cancelled' WHERE razorpay_order_id=? AND user_id=?`,
        [razorpay_order_id || '', userId]
      );
      req.flash('error', 'Payment failed. Dobara try karein.');
      return res.redirect('/cart');
    }

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      await db.query(
        `UPDATE orders SET payment_status='failed',status='cancelled' WHERE razorpay_order_id=? AND user_id=?`,
        [razorpay_order_id, userId]
      );
      req.flash('error', 'Payment verify nahi hui. Dobara try karein.');
      return res.redirect('/cart');
    }

    const [orders] = await db.query(
      `SELECT * FROM orders WHERE razorpay_order_id=? AND user_id=? AND payment_status='pending'`,
      [razorpay_order_id, userId]
    );
    if (orders.length === 0) {
      req.flash('error', 'Order nahi mila ya already processed hai.');
      return res.redirect('/orders');
    }
    const orderId = orders[0].id;

    const [existingItems] = await db.query('SELECT id FROM order_items WHERE order_id=? LIMIT 1', [orderId]);
    if (existingItems.length > 0) {
      req.flash('success', `Payment successful! Order ID: #${orderId}`);
      return res.redirect(`/orders/${orderId}`);
    }

    const [cartItems] = await db.query(
      `SELECT c.*, p.price, p.discount_price, p.stock, p.name
       FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`,
      [userId]
    );

    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        await db.query(`UPDATE orders SET payment_status='failed',status='cancelled' WHERE id=?`, [orderId]);
        req.flash('error', `"${item.name}" ka stock available nahi. Payment refund ho jaayegi.`);
        return res.redirect('/cart');
      }
    }

    await db.query(
      `UPDATE orders SET payment_status='paid',razorpay_payment_id=?,status='processing' WHERE id=?`,
      [razorpay_payment_id, orderId]
    );

    for (const item of cartItems) {
      const price = item.discount_price || item.price;
      await db.query(
        `INSERT INTO order_items (order_id,product_id,quantity,price,size,color) VALUES (?,?,?,?,?,?)`,
        [orderId, item.product_id, item.quantity, price, item.size, item.color]
      );
      await db.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    if (coupon_id) {
      await db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon_id]);
      await db.query('INSERT INTO coupon_uses (coupon_id,user_id,order_id) VALUES (?,?,?)', [coupon_id, userId, orderId]);
    }

    await db.query('DELETE FROM cart WHERE user_id = ?', [userId]);
    req.flash('success', `Payment successful! Order ID: #${orderId}`);
    return res.redirect(`/orders/${orderId}`);
  } catch (err) {
    console.error('Verify payment error:', err);
    req.flash('error', 'Payment verify karne mein error aaya.');
    return res.redirect('/cart');
  }
};


// ========================
// GET ORDER DETAIL
// ========================
exports.getOrder = async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );
    if (orders.length === 0) return res.redirect('/orders');

    const [items] = await db.query(
      `SELECT oi.*, p.name, p.image FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
      [req.params.id]
    );
    res.render('orders/detail', { title: `Order #${req.params.id}`, order: orders[0], items });
  } catch (err) {
    console.error(err); return res.redirect('/');
  }
};


// ========================
// GET MY ORDERS
// ========================
exports.getMyOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.user.id]
    );
    res.render('orders/list', { title: 'My Orders', orders });
  } catch (err) {
    console.error(err); return res.redirect('/');
  }
};
