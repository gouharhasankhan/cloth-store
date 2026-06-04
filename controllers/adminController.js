
// controllers/adminController.js

const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// ========================
// MULTER CONFIG
// ========================

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    const dir = 'public/images/products';

    if (!fs.existsSync(dir)) {

      fs.mkdirSync(dir, {
        recursive: true
      });

    }

    cb(null, dir);

  },

  filename: (req, file, cb) => {

    cb(
      null,
      Date.now() +
      path.extname(file.originalname)
    );

  }

});

exports.upload = multer({ storage });


// ========================
// GET DASHBOARD
// ========================

exports.getDashboard = async (req, res) => {

  try {

    const [[{ totalUsers }]] =
      await db.query(
        `SELECT COUNT(*) as totalUsers
         FROM users
         WHERE role = "user"`
      );

    const [[{ totalProducts }]] =
      await db.query(
        `SELECT COUNT(*) as totalProducts
         FROM products`
      );

    const [[{ totalOrders }]] =
      await db.query(
        `SELECT COUNT(*) as totalOrders
         FROM orders`
      );

    const [[{ totalRevenue }]] =
      await db.query(
        `SELECT COALESCE(SUM(total_amount),0)
         as totalRevenue
         FROM orders
         WHERE status != "cancelled"`
      );

    const [recentOrders] =
      await db.query(

        `SELECT o.*, u.name as user_name
         FROM orders o
         JOIN users u
         ON o.user_id = u.id
         ORDER BY o.created_at DESC
         LIMIT 5`

      );

    res.render('admin/dashboard', {

      title: 'Admin Dashboard',

      totalUsers,

      totalProducts,

      totalOrders,

      totalRevenue,

      recentOrders

    });

  } catch (err) {

    console.log(err);

    return res.redirect('/');
  }

};


// ========================
// PRODUCTS
// ========================

// GET PRODUCTS

exports.getProducts = async (req, res) => {

  try {

    const [products] =
      await db.query(

        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c
         ON p.category_id = c.id
         ORDER BY p.created_at DESC`

      );

    const [categories] =
      await db.query(
        'SELECT * FROM categories'
      );

    res.render('admin/products', {

      title: 'Manage Products',

      products,

      categories

    });

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to load products'
    );

    return res.redirect('/admin');
  }

};


// ADD PRODUCT

exports.addProduct = async (req, res) => {

  try {

    const {

      name,
      description,
      price,
      discount_price,
      stock,
      category_id,
      sizes,
      colors,
      is_featured

    } = req.body;

    // IMAGE

    const image = req.file
      ? `/images/products/${req.file.filename}`
      : '/images/default.jpg';

    // INSERT

    await db.query(

      `INSERT INTO products
      (
        name,
        description,
        price,
        discount_price,
        stock,
        category_id,
        image,
        sizes,
        colors,
        is_featured
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

      [
        name,
        description,
        price,
        discount_price || null,
        stock,
        category_id,
        image,
        sizes,
        colors,
        is_featured ? 1 : 0
      ]

    );

    req.flash(
      'success',
      'Product added successfully'
    );

    return res.redirect('/admin/products');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to add product'
    );

    return res.redirect('/admin/products');
  }

};


// UPDATE PRODUCT

exports.updateProduct = async (req, res) => {

  try {

    const {

      name,
      description,
      price,
      discount_price,
      stock,
      category_id,
      sizes,
      colors,
      is_featured

    } = req.body;

    let query;
    let params;

    // WITH IMAGE

    if (req.file) {

      const image =
        `/images/products/${req.file.filename}`;

      query =

        `UPDATE products
         SET
         name=?,
         description=?,
         price=?,
         discount_price=?,
         stock=?,
         category_id=?,
         image=?,
         sizes=?,
         colors=?,
         is_featured=?
         WHERE id=?`;

      params = [

        name,
        description,
        price,
        discount_price || null,
        stock,
        category_id,
        image,
        sizes,
        colors,
        is_featured ? 1 : 0,
        req.params.id

      ];

    }

    // WITHOUT IMAGE

    else {

      query =

        `UPDATE products
         SET
         name=?,
         description=?,
         price=?,
         discount_price=?,
         stock=?,
         category_id=?,
         sizes=?,
         colors=?,
         is_featured=?
         WHERE id=?`;

      params = [

        name,
        description,
        price,
        discount_price || null,
        stock,
        category_id,
        sizes,
        colors,
        is_featured ? 1 : 0,
        req.params.id

      ];

    }

    await db.query(query, params);

    req.flash(
      'success',
      'Product updated successfully'
    );

    return res.redirect('/admin/products');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to update product'
    );

    return res.redirect('/admin/products');
  }

};


// DELETE PRODUCT

exports.deleteProduct = async (req, res) => {

  try {

    await db.query(

      'DELETE FROM products WHERE id = ?',

      [req.params.id]

    );

    req.flash(
      'success',
      'Product deleted successfully'
    );

    return res.redirect('/admin/products');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to delete product'
    );

    return res.redirect('/admin/products');
  }

};


// ========================
// ORDERS
// ========================

// GET ORDERS

exports.getOrders = async (req, res) => {

  try {

    const [orders] =
      await db.query(

        `SELECT o.*, u.name as user_name
         FROM orders o
         JOIN users u
         ON o.user_id = u.id
         ORDER BY o.created_at DESC`

      );

    res.render('admin/orders', {

      title: 'Manage Orders',

      orders

    });

  } catch (err) {

    console.log(err);

    return res.redirect('/admin');
  }

};


// UPDATE ORDER STATUS

exports.updateOrderStatus = async (req, res) => {

  try {

    await db.query(

      `UPDATE orders
       SET status = ?
       WHERE id = ?`,

      [
        req.body.status,
        req.params.id
      ]

    );

    req.flash(
      'success',
      'Order status updated successfully'
    );

    return res.redirect('/admin/orders');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to update order'
    );

    return res.redirect('/admin/orders');
  }

};


// ========================
// USERS
// ========================

exports.getUsers = async (req, res) => {

  try {

    const [users] =
      await db.query(

        `SELECT *
         FROM users
         ORDER BY created_at DESC`

      );

    res.render('admin/users', {

      title: 'Manage Users',

      users

    });

  } catch (err) {

    console.log(err);

    return res.redirect('/admin');
  }

};


// ========================
// CATEGORIES
// ========================

// GET CATEGORIES

exports.getCategories = async (req, res) => {

  try {

    const [categories] =
      await db.query(
        'SELECT * FROM categories'
      );

    res.render('admin/categories', {

      title: 'Manage Categories',

      categories

    });

  } catch (err) {

    console.log(err);

    return res.redirect('/admin');
  }

};


// ADD CATEGORY

exports.addCategory = async (req, res) => {

  try {

    const {
      name,
      slug
    } = req.body;

    await db.query(

      `INSERT INTO categories
       (name, slug)
       VALUES (?, ?)`,

      [name, slug]

    );

    req.flash(
      'success',
      'Category added successfully'
    );

    return res.redirect('/admin/categories');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to add category'
    );

    return res.redirect('/admin/categories');
  }

};


// DELETE CATEGORY

exports.deleteCategory = async (req, res) => {

  try {

    await db.query(

      'DELETE FROM categories WHERE id = ?',

      [req.params.id]

    );

    req.flash(
      'success',
      'Category deleted successfully'
    );

    return res.redirect('/admin/categories');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to delete category'
    );

    return res.redirect('/admin/categories');
  }

};

