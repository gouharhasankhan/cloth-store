const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

router.get('/', (req, res) => res.redirect('/admin/dashboard'));
router.get('/dashboard', adminController.getDashboard);

// Products
router.get('/products', adminController.getProducts);
router.post('/products/add', adminController.upload.single('image'), adminController.addProduct);
router.post('/products/update/:id', adminController.upload.single('image'), adminController.updateProduct);
router.delete('/products/delete/:id', adminController.deleteProduct);

// Orders
router.get('/orders', adminController.getOrders);
router.post('/orders/status/:id', adminController.updateOrderStatus);

// Users
router.get('/users', adminController.getUsers);
router.post('/users/toggle-block/:id', adminController.toggleBlockUser);

// Categories
router.get('/categories', adminController.getCategories);
router.post('/categories/add', adminController.addCategory);
router.delete('/categories/delete/:id', adminController.deleteCategory);

// Coupons
router.get('/coupons', adminController.getCoupons);
router.post('/coupons/add', adminController.addCoupon);
router.post('/coupons/toggle/:id', adminController.toggleCoupon);
router.delete('/coupons/delete/:id', adminController.deleteCoupon);

// Settings
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);

module.exports = router;
