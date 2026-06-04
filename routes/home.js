// routes/home.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [featured] = await db.query('SELECT * FROM products WHERE is_featured = 1 LIMIT 6');
    const [categories] = await db.query('SELECT * FROM categories LIMIT 6');
    const [newArrivals] = await db.query('SELECT * FROM products ORDER BY created_at DESC LIMIT 4');
    res.render('home', { title: 'Home', featured, categories, newArrivals });
  } catch (err) {
    console.error(err);
    res.render('home', { title: 'Home', featured: [], categories: [], newArrivals: [] });
  }
});

module.exports = router;
