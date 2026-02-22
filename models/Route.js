const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Route = sequelize.define(
  "Route",
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

    name: { type: DataTypes.STRING, allowNull: false },
    origin: { type: DataTypes.STRING, allowNull: false },
    destination: { type: DataTypes.STRING, allowNull: false },
    distance_km: DataTypes.DECIMAL,
    estimated_duration_minutes: DataTypes.INTEGER,
  },
  {
    tableName: "routes",
    timestamps: true,
    underscored: true,
  }
);



module.exports = Route;
