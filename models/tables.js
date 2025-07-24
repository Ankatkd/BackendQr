// backend/models/tables.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/config");

// Define Table Model using Sequelize
const Table = sequelize.define("Table", {
  // Using 'number' as the primary key for the table
  number: { 
    type: DataTypes.INTEGER,
    primaryKey: true, // This implicitly makes it unique and indexed
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("available", "occupied"),
    defaultValue: "available",
  },
  capacity: { // Optional: Add a capacity field for tables
    type: DataTypes.INTEGER,
    allowNull: true,
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
  tableName: "tables",
  timestamps: true, // Enable Sequelize to manage createdAt and updatedAt
});

module.exports = Table;
