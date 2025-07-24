const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/config"); // ✅ Correct import path and destructuring

const Coupon = sequelize.define("Coupon", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  discountAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  discountType: { type: DataTypes.ENUM('fixed', 'percentage'), defaultValue: 'fixed', allowNull: false },
  validUntil: { type: DataTypes.DATE, allowNull: true }, // Date when coupon expires
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
  createdAt: { // Add timestamps for consistency
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: "coupons",
  timestamps: false, // Or true if you want Sequelize to manage them
});

// ✅ IMPORTANT: Remove the sequelize.sync() from here.
module.exports = Coupon;