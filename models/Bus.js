const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Bus = sequelize.define(
  "Bus",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id'
      }
    },

    driver_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Foreign key to Driver - each bus is assigned to a single driver"
      ,
      references: {
        model: 'users',
        key: 'id'
      }
    },

    plate_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    model: {
      type: DataTypes.STRING,
    },

    seat_layout: {
      type: DataTypes.ENUM('25','30','50'),
      allowNull: false,
      defaultValue: '30'
    },

    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM('ACTIVE','INACTIVE'),
      allowNull: false,
      defaultValue: 'ACTIVE'
    },
  },
  {
    tableName: "buses",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['company_id', 'plate_number'] }
    ]
  }
);


  

module.exports = Bus;
