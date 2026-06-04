// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isLoggedIn, isGuest } = require('../middleware/auth');

router.get('/register', isGuest, authController.getRegister);
router.post('/register', isGuest, authController.postRegister);

router.get('/login', isGuest, authController.getLogin);
router.post('/login', isGuest, authController.postLogin);

router.get('/logout', authController.logout);

router.get('/profile', isLoggedIn, authController.getProfile);
router.post('/profile', isLoggedIn, authController.updateProfile);

module.exports = router;
