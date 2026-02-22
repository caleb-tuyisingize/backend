const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Location = sequelize.define(
  "Location",
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
      allowNull: true,
    },

    schedule_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
    },

    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false,
    },

    speed: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },

    heading: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },

    accuracy: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },

    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "locations",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["bus_id"] },
      { fields: ["driver_id"] },
      { fields: ["schedule_id"] },
      { fields: ["timestamp"] },
    ],
  }
);

module.exports = Location;
