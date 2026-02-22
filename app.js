const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const sequelize = require("./config/database")
const routes = require("./routes")
dotenv.config();



const app = express();

app.use(helmet());
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors());
// Request logging
app.use(morgan('dev'));
// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to SAFARIX API',
    version: '1.0.0',
    docs: process.env.APP_URL + '/api-docs',
    endpoints: {
      auth: '/api/auth',
     
    }
  });
});


app.use("/api",routes)

const connectDatabase = async () => {
  try {
    console.log(' Connecting to database...');
    
    // Custom retry logic with better timeout handling
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(` Attempt ${attempts}/${maxAttempts}...`);
        
        // Use query instead of authenticate for better control
        await sequelize.query('SELECT 1');
        console.log(' Database connected successfully');
        
        return true;
      } catch (error) {
        console.error(` Attempt ${attempts} failed:`, error.message);
        
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return true;
  } catch (error) {
    console.error(' Database connection failed after all attempts:', error);
    process.exit(1);
  }
};


const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    console.log(' Starting server...');
    
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`API URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
      console.log(`Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });
    
    // Initialize Socket.IO for real-time GPS tracking
    const { initializeSocket } = require('./config/socket');
    initializeSocket(server);
    console.log(' Socket.IO initialized for real-time tracking');
    
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });
    // Start background task: expire seat locks
    const { SeatLock, Ticket } = require('./models');
    const expireLocks = async () => {
      try {
        const now = new Date();
        const expired = await SeatLock.findAll({ where: { status: 'ACTIVE', expires_at: { [require('sequelize').Op.lte]: now } } });
        for (const lock of expired) {
          try {
            lock.status = 'EXPIRED';
            await lock.save();
            if (lock.ticket_id) {
              const ticket = await Ticket.findByPk(lock.ticket_id);
              if (ticket && ticket.status === 'PENDING_PAYMENT') {
                ticket.status = 'EXPIRED';
                await ticket.save();
              }
            }
          } catch (e) {
            console.error('Failed to expire lock', lock.id, e.message || e);
          }
        }
      } catch (err) {
        console.error('expireLocks error', err.message || err);
      }
    };

    // Run every 30 seconds
    setInterval(expireLocks, 30 * 1000);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();



