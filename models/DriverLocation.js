const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DriverLocation = sequelize.define('DriverLocation', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'driver_locations',
  timestamps: false,
  underscored: true
});

module.exports = DriverLocation;
