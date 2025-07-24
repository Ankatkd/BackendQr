// backend/models/payment.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/config");
const moment = require("moment");

// Define Payment Model using Sequelize
const Payment = sequelize.define("Payment", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  // Your custom generated order ID (e.g., YYMMDDXXXX)
  customOrderId: { 
    type: DataTypes.STRING(10), // YYMMDDXXXX is 10 characters
    allowNull: false,
    unique: true, // Keep this unique as it's your internal order ID
  },
  phoneNumber: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2), // Use DECIMAL for currency precision
    allowNull: false,
  },
  razorpayOrderId: {
    type: DataTypes.STRING(255),
    // Removed 'unique: true' to reduce index count. Razorpay itself ensures uniqueness.
    allowNull: true,
  },
  razorpayPaymentId: { 
    type: DataTypes.STRING(255),
    // Removed 'unique: true' to reduce index count. Razorpay itself ensures uniqueness.
    allowNull: true,
  },
  tableNumber: { 
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  status: {
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
  tableName: "payments",
  timestamps: false, // Manually managing createdAt and updatedAt
});

// Helper function: Generate Custom Order ID (YYMMDDXXXX - more robust)
const getNextCustomOrderId = async () => {
  const datePart = moment().format("YYMMDD");
  // Generate a random 4-digit number to append (e.g., 1234)
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString(); 
  return `${datePart}${randomPart}`; // Example: 2506041234
};

// Helper function: Create initial payment record
const createInitialPaymentRecord = async (phoneNumber, amount, tableNumber, razorpayOrderId, status, customOrderId) => {
  try {
    const payment = await Payment.create({
      customOrderId,
      phoneNumber,
      amount,
      tableNumber,
      razorpayOrderId,
      razorpayPaymentId: null,
      status: status || "Pending",
    });
    return { success: true, paymentRecord: payment };
  } catch (error) {
    console.error("Error creating initial payment record:", error);
    throw error;
  }
};

// Helper function: Update payment status and Razorpay Payment ID
const updatePaymentStatusAndId = async (razorpayOrderId, newStatus, razorpayPaymentId = null) => {
  try {
    const updateData = {
      status: newStatus,
      updatedAt: sequelize.literal('CURRENT_TIMESTAMP')
    };
    if (razorpayPaymentId) {
      updateData.razorpayPaymentId = razorpayPaymentId;
    }

    const [updatedRows] = await Payment.update(updateData, {
      where: { razorpayOrderId: razorpayOrderId },
    });

    return updatedRows > 0
      ? { success: true, message: "Payment status updated" }
      : { success: false, error: "Payment record not found or no changes made" };
  } catch (error) {
    console.error("Error updating payment status and ID:", error);
    throw error;
  }
};

// Helper to find a payment by customOrderId
const findPaymentByCustomOrderId = async (customOrderId) => {
  try {
    const payment = await Payment.findOne({
      where: { customOrderId: customOrderId }
    });
    return payment;
  } catch (error) {
    console.error("Error finding payment by customOrderId:", error);
    throw error;
  }
};

// Helper to find a payment by razorpayOrderId
const findPaymentByRazorpayOrderId = async (razorpayOrderId) => {
  try {
    const payment = await Payment.findOne({
      where: { razorpayOrderId: razorpayOrderId }
    });
    return payment;
  } catch (error) {
    console.error("Error finding payment by Razorpay Order ID:", error);
    throw error;
  }
};

module.exports = {
  Payment, // Export the Payment model itself
  getNextCustomOrderId,
  createInitialPaymentRecord,
  updatePaymentStatusAndId,
  findPaymentByCustomOrderId,
  findPaymentByRazorpayOrderId,
};
