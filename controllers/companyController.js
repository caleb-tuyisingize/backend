const { Company, User } = require('../models');

// Get companies with pending status
const getPendingCompanies = async (req, res) => {
  try {
    const companies = await Company.findAll({ where: { status: 'pending' } });
    res.json(companies);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Approve a company
const approveCompany = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    company.is_approved = true;
    company.status = 'approved';
    company.approval_date = new Date();
    company.approved_by = req.userId;

    await company.save();

    // activate owner user
    const owner = await User.findByPk(company.owner_id);
    if (owner) await owner.update({ is_active: true });

    res.json({ message: 'Company approved', company });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Reject a company
const rejectCompany = async (req, res) => {
  try {
    const { reason } = req.body;
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });

    company.is_approved = false;
    company.status = 'rejected';
    company.approval_date = new Date();
    company.approved_by = req.userId;

    await company.save();

    // deactivate owner user
    const owner = await User.findByPk(company.owner_id);
    if (owner) await owner.update({ is_active: false });

    res.json({ message: 'Company rejected', company, reason: reason || null });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getPendingCompanies,
  approveCompany,
  rejectCompany
};
