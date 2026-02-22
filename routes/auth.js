const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require("../middleware/authenticate")
// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me',auth, authController.getMe);
router.put('/me', auth, authController.updateProfile);
router.post('/change-password', auth, authController.changePassword);

module.exports = router;
