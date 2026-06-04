// routes/products.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { isLoggedIn } = require('../middleware/auth');

router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProduct);
router.post('/:id/review', isLoggedIn, productController.addReview);

module.exports = router;
