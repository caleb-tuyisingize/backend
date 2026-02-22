const { Company, Bus, Ticket, User } = require('../models');
const { Sequelize } = require('sequelize');
const pgPool = require('../config/pgPool');

// Return admin dashboard stats with growth metrics
const getStats = async (req, res) => {
  try {
    const totalCompanies = await Company.count();
    const activeCompanies = await Company.count({ where: { status: 'approved' } });
    const totalBuses = await Bus.count();
    const totalTickets = await Ticket.count();
    const totalUsers = await User.count({ where: { role: 'commuter' } });

    // Total revenue from all tickets
    const revenueResult = await Ticket.findAll({
      attributes: [[Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('price')), 0), 'total']]
    });
    const totalRevenue = parseFloat(revenueResult[0].get('total')) || 0;

    // Tickets sold today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ticketsToday = await Ticket.count({
      where: {
        created_at: {
          [Sequelize.Op.gte]: today
        }
      }
    });

    res.json({
      totalCompanies,
      activeCompanies,
      totalBuses,
      totalTickets,
      totalRevenue,
      totalCommuters: totalUsers,
      ticketsToday,
      // Mock growth percentages (you can calculate real growth from historical data)
      growth: {
        commuters: 12.5,
        companies: 8.3,
        revenue: 23.7,
        buses: 5.2,
        tickets: 15.8
      }
    });
  } catch (error) {
    console.error('getStats error:', error);
    res.status(400).json({ error: error.message });
  }
};

// Return companies list (optionally filter pending)
const getCompanies = async (req, res) => {
  try {
    const { filter } = req.query; // e.g., 'pending'
    const where = {};
    if (filter === 'pending') where.status = 'pending';

    const companies = await Company.findAll({ 
      where,
      order: [['created_at', 'DESC']]
    });

    // Map fields to frontend expected shapes (camelCase)
    const mapped = companies.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone_number || '',
      status: c.status,
      subscriptionStatus: c.subscription_status || 'inactive',
      subscriptionPlan: c.subscription_plan || 'Free Trial',
      ownerId: c.owner_id,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));

    res.json({ companies: mapped });
  } catch (error) {
    console.error('getCompanies error:', error);
    res.status(400).json({ error: error.message });
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'full_name', 'email', 'role', 'is_active', 'email_verified', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    const mapped = users.map(u => ({
      id: u.id,
      name: u.full_name,
      email: u.email,
      role: u.role,
      status: u.is_active ? 'active' : 'suspended',
      emailVerified: u.email_verified,
      registered: u.created_at
    }));

    res.json({ users: mapped });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(400).json({ error: error.message });
  }
};

// Get all buses with company info
const getBuses = async (req, res) => {
  try {
    const buses = await Bus.findAll({
      include: [{
        model: Company,
        attributes: ['id', 'name']
      }],
      order: [['created_at', 'DESC']]
    });

    const mapped = buses.map(b => ({
      id: b.id,
      plateNumber: b.plate_number,
      model: b.model,
      capacity: b.capacity,
      status: b.status,
      companyId: b.company_id,
      companyName: b.Company ? b.Company.name : 'N/A',
      createdAt: b.created_at
    }));

    res.json({ buses: mapped });
  } catch (error) {
    console.error('getBuses error:', error);
    res.status(400).json({ error: error.message });
  }
};

// Get recent tickets with passenger and route info
const getRecentTickets = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const query = `
      SELECT 
        t.id,
        t.booking_ref,
        t.price,
        t.status,
        t.seat_number,
        t.created_at,
        t.company_id,
        u.full_name as passenger_name,
        u.email as passenger_email,
        s.departure_time,
        s.arrival_time,
        r.origin,
        r.destination,
        c.name as company_name
      FROM tickets t
      LEFT JOIN users u ON t.passenger_id = u.id
      LEFT JOIN schedules s ON t.schedule_id = s.id
      LEFT JOIN routes r ON s.route_id = r.id
      LEFT JOIN companies c ON t.company_id = c.id
      ORDER BY t.created_at DESC
      LIMIT $1
    `;

    const result = await pgPool.query(query, [limit]);
    
    const mapped = result.rows.map(row => ({
      id: row.id,
      bookingReference: row.booking_ref,
      price: parseFloat(row.price),
      status: row.status,
      seatNumber: row.seat_number,
      passengerName: row.passenger_name || 'N/A',
      passengerEmail: row.passenger_email || '',
      route: `${row.origin || 'N/A'} → ${row.destination || 'N/A'}`,
      companyId: row.company_id,
      companyName: row.company_name || 'N/A',
      date: row.created_at
    }));

    res.json({ tickets: mapped });
  } catch (error) {
    console.error('getRecentTickets error:', error);
    res.status(400).json({ error: error.message });
  }
};

// Get revenue data by month (last 6 months)
const getRevenueData = async (req, res) => {
  try {
    const query = `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
        COALESCE(SUM(price), 0) as revenue,
        COUNT(*) as tickets
      FROM tickets
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `;

    const result = await pgPool.query(query);
    
    res.json({ revenueData: result.rows });
  } catch (error) {
    console.error('getRevenueData error:', error);
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getStats,
  getCompanies,
  getUsers,
  getBuses,
  getRecentTickets,
  getRevenueData
};
