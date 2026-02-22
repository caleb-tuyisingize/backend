const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ScheduleJournal = sequelize.define(
  "ScheduleJournal",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    company_id: { type: DataTypes.UUID, allowNull: false },
    schedule_id: { type: DataTypes.UUID, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false },
    performed_by: { type: DataTypes.UUID, allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true }
  },
  {
    tableName: "schedule_journals",
    timestamps: true,
    underscored: true,
  }
);

module.exports = ScheduleJournal;
