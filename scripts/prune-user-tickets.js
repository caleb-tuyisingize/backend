#!/usr/bin/env node
// Prune tickets for a commuter: permanently delete older tickets keeping latest N
// Usage: node scripts/prune-user-tickets.js <email> [keep=3]

const { sequelize, User, Ticket, Schedule, SeatLock } = require('../models');

(async () => {
  try {
    const email = process.argv[2];
    const keep = parseInt(process.argv[3], 10) || 3;

    if (!email) {
      console.error('Usage: node scripts/prune-user-tickets.js <email> [keep=3]');
      process.exit(1);
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.error('User not found for email:', email);
      process.exit(2);
    }

    console.log(`Found user ${user.full_name || user.email} (${user.id}). Loading tickets...`);

    const tickets = await Ticket.findAll({ where: { passenger_id: user.id }, order: [['createdAt', 'DESC']] });
    console.log(`Total tickets for user: ${tickets.length}. Keeping latest ${keep}.`);

    const toRemove = tickets.slice(keep);
    if (toRemove.length === 0) {
      console.log('Nothing to remove.');
      process.exit(0);
    }

    for (const tkt of toRemove) {
      console.log(`Removing ticket ${tkt.id} (seat ${tkt.seat_number}, status ${tkt.status})`);
      await sequelize.transaction(async (trx) => {
        // remove any seat locks referencing this ticket
        await SeatLock.destroy({ where: { ticket_id: tkt.id }, transaction: trx });

        // if ticket was confirmed, adjust schedule seat counts
        if (tkt.status === 'CONFIRMED') {
          const schedule = await Schedule.findByPk(tkt.schedule_id, { transaction: trx, lock: trx.LOCK.UPDATE });
          if (schedule) {
            schedule.available_seats = parseInt(schedule.available_seats || 0, 10) + 1;
            schedule.booked_seats = Math.max(0, parseInt(schedule.booked_seats || 0, 10) - 1);
            await schedule.save({ transaction: trx });
          }
        }

        // finally delete the ticket row
        await Ticket.destroy({ where: { id: tkt.id }, transaction: trx });
      });
    }

    console.log(`Removed ${toRemove.length} tickets. Done.`);
    process.exit(0);
  } catch (err) {
    console.error('Error pruning tickets:', err && err.stack ? err.stack : err);
    process.exit(3);
  }
})();
