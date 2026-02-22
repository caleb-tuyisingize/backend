/**
 * Trip Management Controller
 * Handles starting and ending trips for real-time GPS tracking
 */

const pool = require('../config/pgPool');

/**
 * Start a trip - Update schedule status to ACTIVE
 * @route POST /api/driver/trips/:scheduleId/start
 */
const startTrip = async (req, res) => {
  const { scheduleId } = req.params;
  const driverId = req.user?.id;

  if (!driverId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Driver authentication required',
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify driver owns this schedule
    const scheduleResult = await client.query(
      `SELECT s.*, d.id as driver_id, d.user_id
       FROM schedules s
       LEFT JOIN drivers d ON s.driver_id = d.id
       WHERE s.id = $1`,
      [scheduleId]
    );

    if (scheduleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
        message: 'Schedule not found',
      });
    }

    const schedule = scheduleResult.rows[0];

    // Verify this user is the driver for this schedule
    if (schedule.user_id !== driverId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to start this trip',
      });
    }

    // Check if schedule is already ACTIVE or COMPLETED
    if (schedule.status === 'ACTIVE') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        error: 'Trip already started',
        message: 'This trip is already active',
      });
    }

    if (schedule.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        error: 'Trip already completed',
        message: 'This trip has already been completed',
      });
    }

    // Update schedule status to ACTIVE
    await client.query(
      `UPDATE schedules 
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      ['ACTIVE', scheduleId]
    );

    await client.query('COMMIT');
    client.release();

    console.log(`🚌 Trip started: Schedule ${scheduleId} by driver ${driverId}`);

    res.json({
      success: true,
      message: 'Trip started successfully',
      schedule: {
        id: scheduleId,
        status: 'ACTIVE',
      },
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    console.error('Error starting trip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start trip',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * End a trip - Update schedule status to COMPLETED
 * @route POST /api/driver/trips/:scheduleId/end
 */
const endTrip = async (req, res) => {
  const { scheduleId } = req.params;
  const driverId = req.user?.id;

  if (!driverId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Driver authentication required',
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Verify driver owns this schedule
    const scheduleResult = await client.query(
      `SELECT s.*, d.id as driver_id, d.user_id
       FROM schedules s
       LEFT JOIN drivers d ON s.driver_id = d.id
       WHERE s.id = $1`,
      [scheduleId]
    );

    if (scheduleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
        message: 'Schedule not found',
      });
    }

    const schedule = scheduleResult.rows[0];

    // Verify this user is the driver for this schedule
    if (schedule.user_id !== driverId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to end this trip',
      });
    }

    // Check if schedule is ACTIVE
    if (schedule.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        error: 'Trip not active',
        message: 'This trip is not currently active',
      });
    }

    // Update schedule status to COMPLETED
    await client.query(
      `UPDATE schedules 
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      ['COMPLETED', scheduleId]
    );

    // Optionally: Remove live location data (or keep for history)
    await client.query(
      `DELETE FROM live_bus_locations WHERE schedule_id = $1`,
      [scheduleId]
    );

    await client.query('COMMIT');
    client.release();

    console.log(`✅ Trip ended: Schedule ${scheduleId} by driver ${driverId}`);

    res.json({
      success: true,
      message: 'Trip ended successfully',
      schedule: {
        id: scheduleId,
        status: 'COMPLETED',
      },
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    console.error('Error ending trip:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end trip',
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * Get current trip status
 * @route GET /api/driver/trips/:scheduleId/status
 */
const getTripStatus = async (req, res) => {
  const { scheduleId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT s.id, s.status, s.departure_time, s.schedule_date,
              r.origin, r.destination,
              b.plate_number as bus_plate
       FROM schedules s
       LEFT JOIN routes r ON s.route_id = r.id
       LEFT JOIN buses b ON s.bus_id = b.id
       WHERE s.id = $1`,
      [scheduleId]
    );
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found',
        message: 'Schedule not found',
      });
    }

    const schedule = result.rows[0];

    res.json({
      success: true,
      schedule: {
        id: schedule.id,
        status: schedule.status,
        departureTime: schedule.departure_time,
        scheduleDate: schedule.schedule_date,
        route: {
          from: schedule.origin,
          to: schedule.destination,
        },
        busPlate: schedule.bus_plate,
      },
    });

  } catch (error) {
    console.error('Error getting trip status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trip status',
      message: error.message || 'Internal server error',
    });
  }
};

module.exports = {
  startTrip,
  endTrip,
  getTripStatus,
};
