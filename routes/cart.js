// routes/cart.js
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { isLoggedIn } = require('../middleware/auth');

router.use(isLoggedIn);

router.get('/', cartController.getCart);
router.post('/add', cartController.addToCart);
router.post('/update', cartController.updateCart);
router.delete('/remove/:id', cartController.removeFromCart);

module.exports = router;
