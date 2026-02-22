const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Payment = sequelize.define(
  "Payment",
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

    schedule_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    payment_method: {
      type: DataTypes.ENUM("mobile_money", "airtel_money", "card_payment"),
      allowNull: false,
    },

    phone_or_card: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    status: {
      type: DataTypes.STRING,
      defaultValue: "PENDING",
    },

    transaction_ref: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
  },
  {
    tableName: "payments",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["schedule_id"] },
      { fields: ["status"] },
      { fields: ["transaction_ref"] },
    ],
  }
);

module.exports = Payment;

