const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Journal = sequelize.define(
  "Journal",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    bus_id: { type: DataTypes.UUID, allowNull: false },

    driver_id: { type: DataTypes.UUID, allowNull: true },

    schedule_id: { type: DataTypes.UUID, allowNull: true },

    company_id: { type: DataTypes.UUID, allowNull: false },

    journal_date: { type: DataTypes.DATEONLY, allowNull: false },

    trip_count: { type: DataTypes.INTEGER, defaultValue: 0 },

    revenue: { type: DataTypes.DECIMAL, defaultValue: 0 },

    fuel_consumed: { type: DataTypes.DECIMAL, defaultValue: 0 },

    notes: DataTypes.TEXT,
  },
  {
    tableName: "journals",
    timestamps: true,
    underscored: true,
  }
);



module.exports = Journal;
