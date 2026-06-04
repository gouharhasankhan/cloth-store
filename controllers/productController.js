
// controllers/productController.js

const db = require('../config/db');


// ========================
// GET ALL PRODUCTS
// ========================

exports.getAllProducts = async (req, res) => {

  try {

    const {

      category,
      search,
      sort,
      minPrice,
      maxPrice

    } = req.query;

    // BASE QUERY

    let query =

      `SELECT
        p.*,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c
      ON p.category_id = c.id
      WHERE 1=1`;

    const params = [];

    // SEARCH

    if (search) {

      query +=
        ' AND p.name LIKE ?';

      params.push(
        `%${search}%`
      );

    }

    // CATEGORY

    if (category) {

      query +=
        ' AND c.slug = ?';

      params.push(category);

    }

    // MIN PRICE

    if (minPrice) {

      query +=
        ' AND p.price >= ?';

      params.push(minPrice);

    }

    // MAX PRICE

    if (maxPrice) {

      query +=
        ' AND p.price <= ?';

      params.push(maxPrice);

    }

    // SORTING

    if (sort === 'price_low') {

      query +=
        ' ORDER BY p.price ASC';

    }

    else if (sort === 'price_high') {

      query +=
        ' ORDER BY p.price DESC';

    }

    else if (sort === 'newest') {

      query +=
        ' ORDER BY p.created_at DESC';

    }

    else {

      query +=
        ' ORDER BY p.is_featured DESC, p.created_at DESC';

    }

    // PRODUCTS

    const [products] =
      await db.query(
        query,
        params
      );

    // CATEGORIES

    const [categories] =
      await db.query(
        'SELECT * FROM categories'
      );

    // RENDER

    res.render('products/index', {

      title: 'Products',

      products,

      categories,

      filters: {

        category,

        search,

        sort,

        minPrice,

        maxPrice

      }

    });

  } catch (err) {

    console.log(err);

    return res.redirect('/');
  }

};


// ========================
// GET SINGLE PRODUCT
// ========================

exports.getProduct = async (req, res) => {

  try {

    // PRODUCT

    const [products] =
      await db.query(

        `SELECT
          p.*,
          c.name as category_name
         FROM products p
         LEFT JOIN categories c
         ON p.category_id = c.id
         WHERE p.id = ?`,

        [req.params.id]

      );

    // NOT FOUND

    if (products.length === 0) {

      return res.redirect('/products');
    }

    const product =
      products[0];

    // SIZE ARRAY

    product.sizesArr =
      product.sizes
      ? product.sizes.split(',')
      : [];

    // COLOR ARRAY

    product.colorsArr =
      product.colors
      ? product.colors.split(',')
      : [];

    // RELATED PRODUCTS

    const [related] =
      await db.query(

        `SELECT *
         FROM products
         WHERE category_id = ?
         AND id != ?
         LIMIT 4`,

        [
          product.category_id,
          product.id
        ]

      );

    // REVIEWS

    const [reviews] =
      await db.query(

        `SELECT
          r.*,
          u.name as user_name
         FROM reviews r
         JOIN users u
         ON r.user_id = u.id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC`,

        [product.id]

      );

    // RENDER

    res.render('products/detail', {

      title: product.name,

      product,

      related,

      reviews

    });

  } catch (err) {

    console.log(err);

    return res.redirect('/products');
  }

};


// ========================
// ADD REVIEW
// ========================

exports.addReview = async (req, res) => {

  try {

    const {

      rating,
      comment

    } = req.body;

    // INSERT REVIEW

    await db.query(

      `INSERT INTO reviews
      (
        user_id,
        product_id,
        rating,
        comment
      )
      VALUES (?, ?, ?, ?)`,

      [
        req.session.user.id,
        req.params.id,
        rating,
        comment
      ]

    );

    req.flash(
      'success',
      'Review submitted successfully'
    );

    return res.redirect(
      `/products/${req.params.id}`
    );

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to submit review'
    );

    return res.redirect(
      `/products/${req.params.id}`
    );
  }

};

