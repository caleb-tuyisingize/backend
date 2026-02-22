const { verifyToken } = require('../config/jwt');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    // Attach full user record when possible
    try {
      const { User } = require('../models');
      const user = await User.findByPk(req.userId);
      req.user = user || null;
      req.mustChangePassword = !!(user && user.must_change_password);
    } catch (e) {
      req.user = null;
      req.mustChangePassword = false;
    }
    console.log('authenticate: token decoded', { userId: req.userId, role: req.userRole });
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = authenticate;