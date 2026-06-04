
// controllers/cartController.js

const db = require('../config/db');


// ========================
// GET CART PAGE
// ========================

exports.getCart = async (req, res) => {

  try {

    const [items] = await db.query(

      `SELECT
        c.*,
        p.name,
        p.price,
        p.discount_price,
        p.image,
        p.stock
      FROM cart c
      JOIN products p
      ON c.product_id = p.id
      WHERE c.user_id = ?`,

      [req.session.user.id]

    );

    // CALCULATE TOTAL

    let total = 0;

    items.forEach(item => {

      const price =
        item.discount_price ||
        item.price;

      total +=
        price * item.quantity;

    });

    res.render('cart/index', {

      title: 'My Cart',

      items,

      total

    });

  } catch (err) {

    console.log(err);

    return res.redirect('/');
  }

};


// ========================
// ADD TO CART
// ========================

exports.addToCart = async (req, res) => {

  try {

    const {

      product_id,
      quantity,
      size,
      color

    } = req.body;

    const userId =
      req.session.user.id;

    // CHECK EXISTING ITEM

    const [existing] =
      await db.query(

        `SELECT *
         FROM cart
         WHERE user_id = ?
         AND product_id = ?
         AND size = ?
         AND color = ?`,

        [
          userId,
          product_id,
          size || '',
          color || ''
        ]

      );

    // UPDATE EXISTING

    if (existing.length > 0) {

      await db.query(

        `UPDATE cart
         SET quantity = quantity + ?
         WHERE id = ?`,

        [
          quantity || 1,
          existing[0].id
        ]

      );

    }

    // INSERT NEW

    else {

      await db.query(

        `INSERT INTO cart
        (
          user_id,
          product_id,
          quantity,
          size,
          color
        )
        VALUES (?, ?, ?, ?, ?)`,

        [
          userId,
          product_id,
          quantity || 1,
          size || '',
          color || ''
        ]

      );

    }

    req.flash(
      'success',
      'Product added to cart successfully'
    );

    return res.redirect('/cart');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to add product to cart'
    );

    return res.redirect('/products');
  }

};


// ========================
// UPDATE CART
// ========================

exports.updateCart = async (req, res) => {

  try {

    const {
      id,
      quantity
    } = req.body;

    // REMOVE IF LESS THAN 1

    if (quantity < 1) {

      await db.query(

        `DELETE FROM cart
         WHERE id = ?
         AND user_id = ?`,

        [
          id,
          req.session.user.id
        ]

      );

    }

    // UPDATE QUANTITY

    else {

      await db.query(

        `UPDATE cart
         SET quantity = ?
         WHERE id = ?
         AND user_id = ?`,

        [
          quantity,
          id,
          req.session.user.id
        ]

      );

    }

    req.flash(
      'success',
      'Cart updated successfully'
    );

    return res.redirect('/cart');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to update cart'
    );

    return res.redirect('/cart');
  }

};


// ========================
// REMOVE FROM CART
// ========================

exports.removeFromCart = async (req, res) => {

  try {

    await db.query(

      `DELETE FROM cart
       WHERE id = ?
       AND user_id = ?`,

      [
        req.params.id,
        req.session.user.id
      ]

    );

    req.flash(
      'success',
      'Item removed from cart'
    );

    return res.redirect('/cart');

  } catch (err) {

    console.log(err);

    req.flash(
      'error',
      'Unable to remove item'
    );

    return res.redirect('/cart');
  }

};

