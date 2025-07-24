// backend/models/feedback.model.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/config");

const Feedback = sequelize.define("Feedback", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderId: { // Link feedback to a specific order
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true, // Assuming one feedback per order
    comment: "The ID of the order this feedback relates to"
  },
  phoneNumber: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: "Phone number of the user submitting feedback"
  },
  serviceRating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
    comment: "Rating for service (1-5)"
  },
  foodRating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
    comment: "Rating for food quality (1-5)"
  },
  priceRating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
    comment: "Rating for price fairness (1-5)"
  },
  timeRating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
    comment: "Rating for delivery/service time (1-5)"
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "User's textual feedback/comment"
  },
  remedy: { // For owner's response/action
    type: DataTypes.TEXT,
    allowNull: true, // Can be null initially
    comment: "Owner's response or action taken for the feedback"
  },
  status: { // e.g., 'New', 'Reviewed', 'Resolved'
    type: DataTypes.ENUM("New", "Reviewed", "Resolved"),
    defaultValue: "New",
    allowNull: false,
    comment: "Status of the feedback review process"
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
  tableName: "feedback",
  timestamps: true,
});

module.exports = Feedback;
