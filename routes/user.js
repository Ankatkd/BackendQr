const { DataTypes } = require("sequelize");
const sequelize = require("../config/config");

const User = sequelize.define("User", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    phoneNumber: {
        type: DataTypes.STRING(15), // Limit to 15 chars
        allowNull: true,
        unique: true
    },
    ipAddress: {
        type: DataTypes.STRING(45), // IPv6-compatible
        allowNull: true
    },
    otp: {
        type: DataTypes.STRING(6), // Standard OTP length
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(100), // Limit to 100 chars
        allowNull: true,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING(255), // Hashed password storage
        allowNull: true
    },
    role: {
        type: DataTypes.ENUM("Manager", "Chef"),
        allowNull: false,
        defaultValue: "Manager" // Set default role
    }
}, {
    tableName: "users",
    timestamps: true // Adds `createdAt` and `updatedAt`
});

module.exports = User;
