const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/authenticate');

// All payment routes require authentication
router.post('/initiate', auth, paymentController.initiatePayment);
router.post('/confirm', auth, paymentController.confirmPayment);
router.post('/book', auth, paymentController.bookTicket);

// MTN Mobile Money payment routes - COMMENTED OUT (functions need to be restored)
// router.post('/mtn/initiate', auth, paymentController.initiateMTNPayment);
// router.get('/mtn/status/:referenceId', auth, paymentController.checkMTNPaymentStatus);
// router.post('/mtn/validate', auth, paymentController.validateMTNPhoneNumber);

module.exports = router;

