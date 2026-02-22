const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Schedule = sequelize.define(
  "Schedule",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    bus_id: { type: DataTypes.UUID, allowNull: false },
    route_id: { type: DataTypes.UUID, allowNull: false },
    driver_id: { type: DataTypes.UUID, allowNull: true },
    company_id: { type: DataTypes.UUID, allowNull: false },

    schedule_date: { type: DataTypes.DATEONLY, allowNull: false },
    departure_time: { type: DataTypes.TIME, allowNull: false }, // TIME WITHOUT TIME ZONE
    arrival_time: { type: DataTypes.TIME, allowNull: false },   // TIME WITHOUT TIME ZONE
    price_per_seat: { type: DataTypes.DECIMAL, allowNull: false },
    total_seats: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
    available_seats: { type: DataTypes.INTEGER, allowNull: false },
    booked_seats: { type: DataTypes.INTEGER, defaultValue: 0 },

    status: {
      type: DataTypes.ENUM("scheduled", "in_progress", "completed", "cancelled"),
      defaultValue: "scheduled",
    },

    ticket_status: {
      type: DataTypes.ENUM('OPEN','CLOSED'),
      allowNull: false,
      defaultValue: 'OPEN',
      // ticket_status: 'OPEN' or 'CLOSED'
    },

    created_by: { type: DataTypes.UUID, allowNull: false },
  },
  {
    tableName: "schedules",
    timestamps: true,
    underscored: true,
  }
);


module.exports = Schedule;
