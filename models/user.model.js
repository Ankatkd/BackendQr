// backend/models/user.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/config");

const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: true, unique: true },
  password: { type: DataTypes.STRING, allowNull: true },
  phoneNumber: {
    type: DataTypes.STRING(15),
    allowNull: false, // Phone number is now mandatory for login
    unique: true,
  },
  // ✅ NEW: Added alternativeContact and address fields
  alternativeContact: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT, // Use TEXT for potentially longer addresses
    allowNull: true,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  role: { type: DataTypes.ENUM("customer", "owner", "chef"), defaultValue: "customer" },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: "users",
  timestamps: true, // Ensure timestamps are managed by Sequelize
});

module.exports = User;
