const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const { requireRoles } = require('../middleware/authorize');
const controller = require('../controllers/busController');

// All routes require authentication and company_admin or admin role
router.use(auth);
router.use(requireRoles(['company_admin','admin']));

router.post('/', controller.createBus);
router.get('/', controller.listBuses);
router.get('/:id', controller.getBus);
router.put('/:id', controller.updateBus);
router.delete('/:id', controller.deleteBus);
router.patch('/:id/status', controller.patchStatus);

module.exports = router;
