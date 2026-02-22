const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Public endpoints (no authentication required)
router.get('/schedules', publicController.getAvailableSchedules);
router.get('/schedules/search', publicController.searchSchedules);
// New search endpoint using pg Pool with parameterized SQL queries
router.get('/schedules/search-pg', publicController.searchSchedulesPg);
router.post('/schedules/search-pg', publicController.searchSchedulesPg);

module.exports = router;
