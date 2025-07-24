// backend/models/otp.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/config");

const Otp = sequelize.define("Otp", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  phoneNumber: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  otpCode: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "otps",
  timestamps: true,
});

module.exports = Otp; // Export the Otp model
