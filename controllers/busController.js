const { User } = require('../models');
const busService = require('../services/busService');

const createBus = async (req, res) => {
  try {
    console.log('busController.createBus payload:', req.body, 'userId:', req.userId);
    const user = await User.findByPk(req.userId);
    const companyId = user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated with user' });

    const payload = {
      plate_number: req.body.plateNumber || req.body.plate_number,
      capacity: req.body.capacity,
      model: req.body.model,
      seat_layout: req.body.seatLayout || req.body.seat_layout,
      driver_id: req.body.driverId || req.body.driver_id || null
    };

    const bus = await busService.createBus(companyId, payload, { assignedBy: user.id });
    res.status(201).json({ bus });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const listBuses = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    const companyId = user?.company_id;
    if (!companyId) return res.json({ buses: [] });

    const buses = await busService.listBuses(companyId);
    res.json({ buses });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getBus = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    const companyId = user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated with user' });

    const bus = await busService.getBus(companyId, req.params.id);
    if (!bus) return res.status(404).json({ error: 'Bus not found' });
    res.json({ bus });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateBus = async (req, res) => {
  try {
    console.log('busController.updateBus payload:', req.body, 'userId:', req.userId, 'params:', req.params);
    const user = await User.findByPk(req.userId);
    const companyId = user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated with user' });

    const payload = {
      plate_number: req.body.plateNumber || req.body.plate_number,
      capacity: req.body.capacity,
      model: req.body.model,
      seat_layout: req.body.seatLayout || req.body.seat_layout,
      driver_id: req.body.driverId !== undefined ? req.body.driverId : req.body.driver_id,
      status: req.body.status
    };

    const bus = await busService.updateBus(companyId, req.params.id, payload, { assignedBy: user.id });
    res.json({ bus });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteBus = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    const companyId = user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated with user' });

    const bus = await busService.softDelete(companyId, req.params.id);
    res.json({ bus });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const patchStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    const companyId = user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'No company associated with user' });

    const { status } = req.body;
    const bus = await busService.setStatus(companyId, req.params.id, status);
    res.json({ bus });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createBus,
  listBuses,
  getBus,
  updateBus,
  deleteBus,
  patchStatus
};
