// backend/models/orders.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/config");

const Order = sequelize.define("Order", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderId: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true, // ✅ Keep this as unique: true
  },
  tableNumber: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  items: {
    type: DataTypes.TEXT, // Store as TEXT in the database
    allowNull: false,
    get() {
      const rawValue = this.getDataValue('items');
      try {
        return rawValue ? JSON.parse(rawValue) : [];
      } catch (e) {
        console.error("Error parsing items JSON from DB:", rawValue, e);
        return [];
      }
    },
    set(value) {
      this.setDataValue('items', JSON.stringify(value || []));
    }
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phoneNumber: { 
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  verifiedByManager: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  cookStatus: {
    type: DataTypes.ENUM("Pending", "Preparing", "Ready", "Served", "Cancelled"),
    defaultValue: "Pending",
    allowNull: false,
  },
  paymentStatus: {
    type: DataTypes.ENUM("Pending", "Paid", "Failed", "Refunded"),
    defaultValue: "Pending",
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
  tableName: "orders",
  timestamps: true,
  // Removed hooks as they are not needed for schema definition and can be problematic.
  // Debugging can be done with console.log in controllers.
});

module.exports = Order;
