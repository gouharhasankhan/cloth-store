
// controllers/authController.js

const db = require('../config/db');
const bcrypt = require('bcryptjs');


// ========================
// GET - REGISTER PAGE
// ========================

exports.getRegister = (req, res) => {

  res.render('auth/register', {
    title: 'Register'
  });

};


// ========================
// POST - REGISTER
// ========================

exports.postRegister = async (req, res) => {

  try {

    const {
      name,
      email,
      password,
      phone
    } = req.body;

    // CHECK EMAIL

    const [existing] =
      await db.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

    if (existing.length > 0) {

      req.flash(
        'error',
        'Email already registered'
      );

      return res.redirect('/auth/register');
    }

    // HASH PASSWORD

    const hashedPassword =
      await bcrypt.hash(password, 10);

    // INSERT USER

    await db.query(

      `INSERT INTO users
      (name, email, password, phone)
      VALUES (?, ?, ?, ?)`,

      [
        name,
        email,
        hashedPassword,
        phone
      ]

    );

    req.flash(
      'success',
      'Registration successful! Please login.'
    );

    return res.redirect('/auth/login');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Something went wrong'
    );

    return res.redirect('/auth/register');
  }

};


// ========================
// GET - LOGIN PAGE
// ========================

exports.getLogin = (req, res) => {

  res.render('auth/login', {
    title: 'Login'
  });

};


// ========================
// POST - LOGIN
// ========================

exports.postLogin = async (req, res) => {

  try {

    const {
      email,
      password
    } = req.body;

    // CHECK USER

    const [users] =
      await db.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

    if (users.length === 0) {

      req.flash(
        'error',
        'Invalid email or password'
      );

      return res.redirect('/auth/login');
    }

    const user = users[0];

    // CHECK PASSWORD

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isMatch) {

      req.flash(
        'error',
        'Invalid email or password'
      );

      return res.redirect('/auth/login');
    }

    // ========================
    // SAVE SESSION
    // ========================

    req.session.user = {

      id: user.id,

      name: user.name,

      email: user.email,

      role: user.role

    };

    // FORCE SAVE SESSION

    req.session.save((err) => {

      if (err) {

        console.log(err);

        req.flash(
          'error',
          'Session error'
        );

        return res.redirect('/auth/login');
      }

      req.flash(
        'success',
        `Welcome back, ${user.name}!`
      );

      // ADMIN REDIRECT

      if (user.role === 'admin') {

        return res.redirect(
          '/admin/dashboard'
        );

      }

      return res.redirect('/');

    });

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Login failed'
    );

    return res.redirect('/auth/login');
  }

};


// ========================
// LOGOUT
// ========================

exports.logout = (req, res) => {

  req.session.destroy((err) => {

    if (err) {

      console.log(err);

      return res.redirect('/');
    }

    // CLEAR COOKIE

    res.clearCookie('connect.sid');

    return res.redirect('/auth/login');

  });

};


// ========================
// PROFILE PAGE
// ========================

exports.getProfile = async (req, res) => {

  try {

    const [users] =
      await db.query(
        'SELECT * FROM users WHERE id = ?',
        [req.session.user.id]
      );

    const [orders] =
      await db.query(

        `SELECT *
         FROM orders
         WHERE user_id = ?
         ORDER BY created_at DESC`,

        [req.session.user.id]

      );

    res.render('auth/profile', {

      title: 'My Profile',

      profile: users[0],

      orders

    });

  } catch (err) {

    console.log(err);

    return res.redirect('/');
  }

};


// ========================
// UPDATE PROFILE
// ========================

exports.updateProfile = async (req, res) => {

  try {

    const {
      name,
      phone,
      address
    } = req.body;

    await db.query(

      `UPDATE users
       SET name = ?,
       phone = ?,
       address = ?
       WHERE id = ?`,

      [
        name,
        phone,
        address,
        req.session.user.id
      ]

    );

    // UPDATE SESSION NAME

    req.session.user.name = name;

    req.flash(
      'success',
      'Profile updated successfully'
    );

    return res.redirect('/auth/profile');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Update failed'
    );

    return res.redirect('/auth/profile');
  }

};

