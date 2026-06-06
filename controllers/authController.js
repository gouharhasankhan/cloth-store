// controllers/authController.js

const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getRegister = (req, res) => res.render('auth/register', { title: 'Register' });

exports.postRegister = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      req.flash('error', 'Email already registered');
      return res.redirect('/auth/register');
    }
    const hashed = await bcrypt.hash(password, 10);
    await db.query(`INSERT INTO users (name,email,password,phone) VALUES (?,?,?,?)`, [name, email, hashed, phone]);
    req.flash('success', 'Registration successful! Please login.');
    return res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong');
    return res.redirect('/auth/register');
  }
};

exports.getLogin = (req, res) => res.render('auth/login', { title: 'Login' });

exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/auth/login');
    }
    const user = users[0];
    if (user.is_blocked) {
      req.flash('error', 'Aapka account block kar diya gaya hai. Support se contact karein.');
      return res.redirect('/auth/login');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/auth/login');
    }
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    req.session.save(err => {
      if (err) { req.flash('error', 'Session error'); return res.redirect('/auth/login'); }
      req.flash('success', `Welcome back, ${user.name}!`);
      return res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/');
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Login failed');
    return res.redirect('/auth/login');
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('fashionhub_sid');
    return res.redirect('/auth/login');
  });
};

exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.user.id]
    );
    res.render('auth/profile', { title: 'My Profile', profile: users[0], orders });
  } catch (err) {
    console.error(err); return res.redirect('/');
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    await db.query('UPDATE users SET name=?,phone=?,address=? WHERE id=?', [name, phone, address, req.session.user.id]);
    req.session.user.name = name;
    req.flash('success', 'Profile updated successfully');
    return res.redirect('/auth/profile');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Update failed');
    return res.redirect('/auth/profile');
  }
};

// ========================
// CHANGE PASSWORD
// ========================
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (new_password !== confirm_password) {
      req.flash('error', 'Naya password aur confirm password match nahi karte');
      return res.redirect('/auth/profile');
    }
    if (new_password.length < 6) {
      req.flash('error', 'Password kam se kam 6 characters ka hona chahiye');
      return res.redirect('/auth/profile');
    }

    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.session.user.id]);
    const isMatch = await bcrypt.compare(current_password, users[0].password);
    if (!isMatch) {
      req.flash('error', 'Current password galat hai');
      return res.redirect('/auth/profile');
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.session.user.id]);
    req.flash('success', 'Password successfully change ho gaya!');
    return res.redirect('/auth/profile');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Password change karne mein error aaya');
    return res.redirect('/auth/profile');
  }
};
