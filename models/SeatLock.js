const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SeatLock = sequelize.define(
  "SeatLock",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    schedule_id: { type: DataTypes.UUID, allowNull: false },
    company_id: { type: DataTypes.UUID, allowNull: false },
    seat_number: { type: DataTypes.STRING, allowNull: false },
    passenger_id: { type: DataTypes.UUID, allowNull: false },
    ticket_id: { type: DataTypes.UUID, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.ENUM("ACTIVE", "EXPIRED", "RELEASED", "CONSUMED"),
      defaultValue: "ACTIVE",
    },
    meta: { type: DataTypes.JSONB, allowNull: true },
  },
  {
    tableName: "seat_locks",
    timestamps: true,
    underscored: true,
    indexes: [
      // Unique constraint ensures only one active lock per schedule+seat when enforced via partial index in Postgres
      { fields: ["schedule_id", "seat_number"] },
    ],
  }
);

module.exports = SeatLock;
