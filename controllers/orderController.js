// controllers/orderController.js - With Razorpay Integration

const db = require('../config/db');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


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

    let total = 0;
    items.forEach(item => {
      const price = item.discount_price || item.price;
      total += price * item.quantity;
    });

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);

    res.render('orders/checkout', {
      title: 'Checkout',
      items,
      total,
      profile: users[0],
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.redirect('/cart');
  }
};


// ========================
// PLACE ORDER (COD)
// ========================

exports.placeOrder = async (req, res) => {
  try {
    const { shipping_address, payment_method } = req.body;
    const userId = req.session.user.id;

    const [items] = await db.query(
      `SELECT c.*, p.price, p.discount_price, p.stock
       FROM cart c JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [userId]
    );

    if (items.length === 0) {
      req.flash('error', 'Your cart is empty');
      return res.redirect('/cart');
    }

    let total = 0;
    items.forEach(item => {
      const price = item.discount_price || item.price;
      total += price * item.quantity;
    });
    if (total < 500) total += 50;

    // Stock check
    for (const item of items) {
      if (item.quantity > item.stock) {
        req.flash('error', `"${item.name}" stock unavailable`);
        return res.redirect('/cart');
      }
    }

    const [result] = await db.query(
      `INSERT INTO orders (user_id, total_amount, payment_method, payment_status, shipping_address)
       VALUES (?, ?, ?, 'pending', ?)`,
      [userId, total, payment_method || 'COD', shipping_address]
    );

    const orderId = result.insertId;

    for (const item of items) {
      const price = item.discount_price || item.price;
      await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, size, color)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, price, item.size, item.color]
      );
      await db.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await db.query('DELETE FROM cart WHERE user_id = ?', [userId]);

    req.flash('success', `Order placed Successfull! Order ID: #${orderId}`);
    return res.redirect(`/orders/${orderId}`);
  } catch (err) {
    console.error('Place order error:', err);
    req.flash('error', 'Order not placed');
    return res.redirect('/cart');
  }
};


// ========================
// CREATE RAZORPAY ORDER
// ========================

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { shipping_address } = req.body;
    const userId = req.session.user.id;

    if (!shipping_address || shipping_address.trim() === '') {
      return res.status(400).json({ success: false, message: 'Shipping address required' });
    }

    const [items] = await db.query(
      `SELECT c.*, p.price, p.discount_price, p.stock, p.name
       FROM cart c JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [userId]
    );

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart Empty' });
    }

    // Stock check
    for (const item of items) {
      if (item.quantity > item.stock) {
        return res.status(400).json({ 
          success: false, 
          message: `"${item.name}"stock not available` 
        });
      }
    }

    let total = 0;
    items.forEach(item => {
      const price = item.discount_price || item.price;
      total += price * item.quantity;
    });
    if (total < 500) total += 50;

    // Razorpay order banao (amount paise mein hota hai)
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // paise mein
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        user_id: userId,
        shipping_address: shipping_address.substring(0, 200)
      }
    });

    // DB mein pending order save karein
    const [result] = await db.query(
      `INSERT INTO orders (user_id, total_amount, payment_method, payment_status, razorpay_order_id, shipping_address)
       VALUES (?, ?, 'Razorpay', 'pending', ?, ?)`,
      [userId, total, razorpayOrder.id, shipping_address]
    );

    const [user] = await db.query('SELECT name, email, phone FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      order_db_id: result.insertId,
      user: user[0]
    });
  } catch (err) {
    console.error('Razorpay order create error:', err);
    res.status(500).json({ success: false, message: 'Payment order not created' });
  }
};


// ========================
// VERIFY RAZORPAY PAYMENT
// ========================

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_db_id,
      shipping_address
    } = req.body;

    // Signature verify karein
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Payment fake laga - order cancel karein
      await db.query(
        `UPDATE orders SET payment_status = 'failed' WHERE razorpay_order_id = ?`,
        [razorpay_order_id]
      );
      req.flash('error', 'Payment not verify.  try again.');
      return res.redirect('/cart');
    }

    // Payment sahi hai - order complete karein
    const userId = req.session.user.id;

    await db.query(
      `UPDATE orders SET 
        payment_status = 'paid', 
        razorpay_payment_id = ?,
        status = 'processing'
       WHERE razorpay_order_id = ? AND user_id = ?`,
      [razorpay_payment_id, razorpay_order_id, userId]
    );

    // Order items add karein
    const [orders] = await db.query(
      'SELECT id FROM orders WHERE razorpay_order_id = ?',
      [razorpay_order_id]
    );
    const orderId = order_db_id || orders[0].id;

    // Cart items fetch karein
    const [items] = await db.query(
      `SELECT c.*, p.price, p.discount_price
       FROM cart c JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [userId]
    );

    for (const item of items) {
      const price = item.discount_price || item.price;
      
      // Check if order_items already added
      const [existing] = await db.query(
        'SELECT id FROM order_items WHERE order_id = ?',
        [orderId]
      );
      
      if (existing.length === 0) {
        await db.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price, size, color)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, item.product_id, item.quantity, price, item.size, item.color]
        );
        await db.query(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // Cart clear karein
    await db.query('DELETE FROM cart WHERE user_id = ?', [userId]);

    req.flash('success', `Payment successful! Order ID: #${orderId}`);
    return res.redirect(`/orders/${orderId}`);
  } catch (err) {
    console.error('Verify payment error:', err);
    req.flash('error', 'Payment verify problem');
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
      `SELECT oi.*, p.name, p.image
       FROM order_items oi JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [req.params.id]
    );

    res.render('orders/detail', {
      title: `Order #${req.params.id}`,
      order: orders[0],
      items
    });
  } catch (err) {
    console.error(err);
    return res.redirect('/');
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
    console.error(err);
    return res.redirect('/');
  }
};
