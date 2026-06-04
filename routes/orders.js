// routes/orders.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isLoggedIn } = require('../middleware/auth');

router.use(isLoggedIn);

router.get('/', orderController.getMyOrders);
router.get('/checkout', orderController.getCheckout);

// COD order
router.post('/place', orderController.placeOrder);

// Razorpay routes
router.post('/razorpay/create', orderController.createRazorpayOrder);
router.post('/razorpay/verify', orderController.verifyRazorpayPayment);

router.get('/:id', orderController.getOrder);

module.exports = router;
