const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Seat = sequelize.define(
  "Seat",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bus_id: { type: DataTypes.UUID, allowNull: false },
    company_id: { type: DataTypes.UUID, allowNull: false },
    seat_number: { type: DataTypes.STRING, allowNull: false },
    row: { type: DataTypes.INTEGER, allowNull: true },
    col: { type: DataTypes.INTEGER, allowNull: true },
    side: { type: DataTypes.ENUM("L", "R"), allowNull: true },
    is_window: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_driver: { type: DataTypes.BOOLEAN, defaultValue: false },
    meta: { type: DataTypes.JSONB, allowNull: true },
  },
  {
    tableName: "seats",
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ["bus_id", "seat_number"] }],
  }
);

module.exports = Seat;
