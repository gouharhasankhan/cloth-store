// controllers/adminController.js

const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Multer ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/images/products';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
exports.upload = multer({ storage });

// ========================
// DASHBOARD
// ========================
exports.getDashboard = async (req, res) => {
  try {
    const [[{ totalUsers }]] = await db.query(`SELECT COUNT(*) as totalUsers FROM users WHERE role='user'`);
    const [[{ totalProducts }]] = await db.query(`SELECT COUNT(*) as totalProducts FROM products`);
    const [[{ totalOrders }]] = await db.query(`SELECT COUNT(*) as totalOrders FROM orders`);
    const [[{ totalRevenue }]] = await db.query(`SELECT COALESCE(SUM(total_amount),0) as totalRevenue FROM orders WHERE status != 'cancelled'`);
    const [recentOrders] = await db.query(
      `SELECT o.*,u.name as user_name FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 5`
    );
    const lowStockThreshold = parseInt(await db.getSetting('low_stock_threshold') || 5);
    const [lowStockProducts] = await db.query(
      `SELECT name, stock FROM products WHERE stock <= ? AND stock > 0 ORDER BY stock ASC LIMIT 5`,
      [lowStockThreshold]
    );
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      totalUsers, totalProducts, totalOrders, totalRevenue,
      recentOrders, lowStockProducts
    });
  } catch (err) {
    console.error(err); return res.redirect('/');
  }
};

// ========================
// PRODUCTS
// ========================
exports.getProducts = async (req, res) => {
  try {
    const [products] = await db.query(
      `SELECT p.*,c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id ORDER BY p.created_at DESC`
    );
    const [categories] = await db.query('SELECT * FROM categories');
    const lowStockThreshold = parseInt(await db.getSetting('low_stock_threshold') || 5);
    res.render('admin/products', { title: 'Manage Products', products, categories, lowStockThreshold });
  } catch (err) {
    console.error(err); req.flash('error', 'Unable to load products'); return res.redirect('/admin');
  }
};

exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, discount_price, stock, category_id, sizes, colors, is_featured } = req.body;
    const image = req.file ? `/images/products/${req.file.filename}` : '/images/default.jpg';
    await db.query(
      `INSERT INTO products (name,description,price,discount_price,stock,category_id,image,sizes,colors,is_featured) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [name, description, price, discount_price || null, stock, category_id, image, sizes, colors, is_featured ? 1 : 0]
    );
    req.flash('success', 'Product added successfully');
    return res.redirect('/admin/products');
  } catch (err) {
    console.error(err); req.flash('error', 'Unable to add product'); return res.redirect('/admin/products');
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { name, description, price, discount_price, stock, category_id, sizes, colors, is_featured } = req.body;
    if (req.file) {
      await db.query(
        `UPDATE products SET name=?,description=?,price=?,discount_price=?,stock=?,category_id=?,image=?,sizes=?,colors=?,is_featured=? WHERE id=?`,
        [name, description, price, discount_price || null, stock, category_id, `/images/products/${req.file.filename}`, sizes, colors, is_featured ? 1 : 0, req.params.id]
      );
    } else {
      await db.query(
        `UPDATE products SET name=?,description=?,price=?,discount_price=?,stock=?,category_id=?,sizes=?,colors=?,is_featured=? WHERE id=?`,
        [name, description, price, discount_price || null, stock, category_id, sizes, colors, is_featured ? 1 : 0, req.params.id]
      );
    }
    req.flash('success', 'Product updated successfully');
    return res.redirect('/admin/products');
  } catch (err) {
    console.error(err); req.flash('error', 'Unable to update product'); return res.redirect('/admin/products');
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    req.flash('success', 'Product deleted');
    return res.redirect('/admin/products');
  } catch (err) {
    console.error(err); req.flash('error', 'Unable to delete product'); return res.redirect('/admin/products');
  }
};

// ========================
// ORDERS
// ========================
exports.getOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.*,u.name as user_name FROM orders o JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC`
    );
    res.render('admin/orders', { title: 'Manage Orders', orders });
  } catch (err) {
    console.error(err); return res.redirect('/admin');
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    await db.query('UPDATE orders SET status=? WHERE id=?', [req.body.status, req.params.id]);
    req.flash('success', 'Order status updated');
    return res.redirect('/admin/orders');
  } catch (err) {
    console.error(err); req.flash('error', 'Unable to update order'); return res.redirect('/admin/orders');
  }
};

// ========================
// USERS
// ========================
exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.query('SELECT * FROM users ORDER BY created_at DESC');
    res.render('admin/users', { title: 'Manage Users', users });
  } catch (err) {
    console.error(err); return res.redirect('/admin');
  }
};

exports.toggleBlockUser = async (req, res) => {
  try {
    await db.query('UPDATE users SET is_blocked = NOT is_blocked WHERE id = ? AND role != "admin"', [req.params.id]);
    req.flash('success', 'User status updated');
    return res.redirect('/admin/users');
  } catch (err) {
    console.error(err); req.flash('error', 'Error'); return res.redirect('/admin/users');
  }
};

// ========================
// CATEGORIES
// ========================
exports.getCategories = async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM categories');
    res.render('admin/categories', { title: 'Manage Categories', categories });
  } catch (err) {
    console.error(err); return res.redirect('/admin');
  }
};

exports.addCategory = async (req, res) => {
  try {
    const { name, slug } = req.body;
    await db.query('INSERT INTO categories (name,slug) VALUES (?,?)', [name, slug]);
    req.flash('success', 'Category added');
    return res.redirect('/admin/categories');
  } catch (err) {
    console.error(err); req.flash('error', 'Unable to add category'); return res.redirect('/admin/categories');
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    req.flash('success', 'Category deleted');
    return res.redirect('/admin/categories');
  } catch (err) {
    console.error(err); req.flash('error', 'Unable to delete category'); return res.redirect('/admin/categories');
  }
};

// ========================
// COUPONS
// ========================
exports.getCoupons = async (req, res) => {
  try {
    const [coupons] = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.render('admin/coupons', { title: 'Manage Coupons', coupons });
  } catch (err) {
    console.error(err); return res.redirect('/admin');
  }
};

exports.addCoupon = async (req, res) => {
  try {
    const { code, type, value, min_order, max_uses, once_per_user, expires_at, is_active } = req.body;
    await db.query(
      `INSERT INTO coupons (code,type,value,min_order,max_uses,once_per_user,expires_at,is_active) VALUES (?,?,?,?,?,?,?,?)`,
      [
        code.toUpperCase().trim(), type, value,
        min_order || 0,
        max_uses || null,
        once_per_user ? 1 : 0,
        expires_at || null,
        is_active ? 1 : 0
      ]
    );
    req.flash('success', 'Coupon created!');
    return res.redirect('/admin/coupons');
  } catch (err) {
    console.error(err);
    req.flash('error', err.code === 'ER_DUP_ENTRY' ? 'Ye coupon code pehle se exist karta hai' : 'Error creating coupon');
    return res.redirect('/admin/coupons');
  }
};

exports.toggleCoupon = async (req, res) => {
  try {
    await db.query('UPDATE coupons SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    req.flash('success', 'Coupon status updated');
    return res.redirect('/admin/coupons');
  } catch (err) {
    console.error(err); req.flash('error', 'Error'); return res.redirect('/admin/coupons');
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    await db.query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    req.flash('success', 'Coupon deleted');
    return res.redirect('/admin/coupons');
  } catch (err) {
    console.error(err); req.flash('error', 'Error'); return res.redirect('/admin/coupons');
  }
};

// ========================
// SETTINGS
// ========================
exports.getSettings = async (req, res) => {
  try {
    const settings = await db.getAllSettings();
    res.render('admin/settings', { title: 'Store Settings', settings });
  } catch (err) {
    console.error(err); return res.redirect('/admin');
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const fields = [
      'delivery_charge', 'free_delivery_above', 'cod_enabled', 'razorpay_enabled',
      'min_order_amount', 'max_items_per_order', 'low_stock_threshold',
      'hide_out_of_stock', 'allow_reviews', 'first_order_discount', 'first_order_discount_value',
      'banner_enabled', 'banner_text', 'banner_color', 'estimated_delivery_days',
      'cod_cities', 'site_name', 'site_tagline', 'contact_phone',
      'contact_email', 'contact_address', 'maintenance_mode'
    ];

    // Checkboxes: agar form mein nahi aaya toh '0'
    const checkboxFields = ['cod_enabled','razorpay_enabled','hide_out_of_stock','allow_reviews','first_order_discount','banner_enabled','maintenance_mode'];

    for (const field of fields) {
      let val;
      if (checkboxFields.includes(field)) {
        val = req.body[field] ? '1' : '0';
      } else {
        val = req.body[field] ?? '';
      }
      await db.query('UPDATE settings SET value=? WHERE key_name=?', [val, field]);
    }

    req.flash('success', 'Settings save ho gayi!');
    return res.redirect('/admin/settings');
  } catch (err) {
    console.error(err); req.flash('error', 'Settings save nahi ho sakin'); return res.redirect('/admin/settings');
  }
};
