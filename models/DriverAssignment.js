const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DriverAssignment = sequelize.define(
  "DriverAssignment",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    bus_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    driver_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    assigned_by: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    assigned_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    unassigned_at: {
      type: DataTypes.DATE,
    },

    reason: DataTypes.TEXT,
    notes: DataTypes.TEXT,
  },
  {
    tableName: "driver_assignments",
    timestamps: true,
    underscored: true,
  }
);


module.exports = DriverAssignment;
