const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");

const MenuItem = sequelize.define("MenuItem", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING },
  price: { type: DataTypes.FLOAT, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  imageUrl: { type: DataTypes.STRING },
});

module.exports = MenuItem;
