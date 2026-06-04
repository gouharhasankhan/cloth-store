// app.js - Main Application Entry Point
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const MySQLStore = require('express-mysql-session')(session);
const app = express();

// Trust proxy for Render/Railway (HTTPS ke liye)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ========================
// MIDDLEWARE SETUP
// ========================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// EJS View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ========================
// MYSQL SESSION STORE
// ========================
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || process.env.MYSQLHOST,
  port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 86400000,
  createDatabaseTable: true,
  connectionLimit: 5,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ========================
// SESSION
// ========================
app.use(session({
  key: 'fashionhub_sid',
  secret: process.env.SESSION_SECRET || 'fallback_secret_change_this',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Flash Messages
app.use(flash());

// ========================
// GLOBAL VARIABLES
// ========================
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  res.locals.appName = process.env.APP_NAME || 'FashionHub';
  next();
});

// ========================
// ROUTES
// ========================
const homeRoutes = require('./routes/home');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

app.use('/', homeRoutes);
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);
app.use('/admin', adminRoutes);

// ========================
// 404 PAGE
// ========================
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// ========================
// ERROR HANDLER
// ========================
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).render('404', { title: 'Server Error' });
});

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 App: ${process.env.APP_NAME || 'FashionHub'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
