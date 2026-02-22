const { DataTypes } = require('sequelize');
const sequelize = require("../config/database")

const Notification = sequelize.define(
  'Notification',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    
    type: {
      type: DataTypes.ENUM(
        'ticket_booked',
        'ticket_cancelled',
        'schedule_update',
        'payment_received',
        'system',
        'subscription_expiring',
        'company_approved'
      ),
      allowNull: false
    },
    
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    
    data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    
    related_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    
    related_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'is_read'] },
      { fields: ['created_at'] },
      { fields: ['type'] }
    ]
  }
);

module.exports = Notification;
