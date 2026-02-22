const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Driver = sequelize.define(
  "Driver",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    license_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    phone: DataTypes.STRING,

    email: DataTypes.STRING,

    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },

    license_expiry: DataTypes.DATE,

    notes: DataTypes.TEXT,
  },
  {
    tableName: "drivers",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['license_number'] },
      { unique: true, fields: ['company_id', 'phone'] }
    ]
  }
);


module.exports = Driver;
