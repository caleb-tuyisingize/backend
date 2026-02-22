const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const auth = require('../middleware/authenticate');
const { isAdmin } = require('../middleware/authorize');

// Admin: list pending companies
router.get('/pending', auth, isAdmin, companyController.getPendingCompanies);

// Admin: approve a company
router.post('/:id/approve', auth, isAdmin, companyController.approveCompany);

// Admin: reject a company
router.post('/:id/reject', auth, isAdmin, companyController.rejectCompany);

module.exports = router;
