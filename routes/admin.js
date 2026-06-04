// routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');

router.use(isAdmin);

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

// Categories
router.get('/categories', adminController.getCategories);
router.post('/categories/add', adminController.addCategory);
router.delete('/categories/delete/:id', adminController.deleteCategory);

module.exports = router;
