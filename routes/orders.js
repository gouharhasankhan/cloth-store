const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isLoggedIn } = require('../middleware/auth');

router.use(isLoggedIn);
router.get('/', orderController.getMyOrders);
router.get('/checkout', orderController.getCheckout);
router.post('/place', orderController.placeOrder);
router.post('/apply-coupon', orderController.applyCoupon);
router.post('/razorpay/create', orderController.createRazorpayOrder);
router.post('/razorpay/verify', orderController.verifyRazorpayPayment);
router.get('/:id', orderController.getOrder);

module.exports = router;
