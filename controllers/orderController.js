// backend/controllers/orderController.js
const Order = require("../models/orders");
const { io } = require("../server"); // Ensure this path is correct
const { Op } = require("sequelize"); // Import Op for Sequelize operators

// Helper to generate a simple unique Order ID
const generateOrderId = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(100 + Math.random() * 900).toString(); // 3-digit random number
  return `${year}${month}${day}${hours}${minutes}${seconds}${random}`;
};

// Function to create a new order
exports.createOrder = async (req, res) => {
  const { tableNumber, items, totalAmount, note, phoneNumber } = req.body; // ✅ Added phoneNumber to request body

  if (!tableNumber || !items || !totalAmount || !phoneNumber) { // ✅ phoneNumber is now required
    return res.status(400).json({ success: false, message: "Table number, items, total amount, and phone number are required." });
  }

  try {
    const orderId = generateOrderId();
    
    const newOrder = await Order.create({
      orderId,
      tableNumber,
      items, // Sequelize model's setter will stringify this
      totalAmount,
      note: note || null,
      phoneNumber, // ✅ Save phoneNumber with the order
      cookStatus: 'Pending', // Initial status for chef
      paymentStatus: 'Pending', // Initial payment status
      verifiedByManager: false, // Initial manager verification status
    });

    // Emit 'newOrder' event specifically for chef dashboard
    // Changed from 'orderStatusUpdate' to 'newOrder' for clarity in event name
    io.emit('newOrder', newOrder); 
    console.log(`New Order created and emitted: ${newOrder.orderId}`);

    res.status(201).json({ success: true, message: "Order placed successfully!", order: newOrder });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: "Failed to place order." });
  }
};

// Function to get all orders (for initial fetch on frontend)
exports.getAllOrders = async (req, res) => {
  try {
    const { phoneNumber } = req.query; // ✅ Get phoneNumber from query parameters

    let whereClause = {};
    if (phoneNumber) {
      whereClause.phoneNumber = phoneNumber; // ✅ Add filter if phoneNumber is provided
    }

    const orders = await Order.findAll({
      where: whereClause, // Apply the filter
      order: [['createdAt', 'DESC']] // Order by newest first
    });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Failed to fetch orders." });
  }
};

// Function to get orders that need manager verification (MISSING FUNCTION - ADDED)
exports.getPendingVerificationOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: {
        paymentStatus: 'Paid', // Assuming only paid orders need verification
        verifiedByManager: false
      },
      order: [['createdAt', 'ASC']] // Oldest first
    });
    res.status(200).json(orders); // Return directly as per original Chef/Owner component
  } catch (error) {
    console.error("Error fetching pending verification orders:", error);
    res.status(500).json({ success: false, message: "Failed to fetch pending verification orders." });
  }
};

// Function to verify an order by manager (MISSING FUNCTION - ADDED)
exports.verifyOrder = async (req, res) => {
  const { orderId } = req.body; // Assuming orderId is sent in body

  try {
    const order = await Order.findOne({ where: { orderId } });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.verifiedByManager) {
      return res.status(400).json({ success: false, message: "Order already verified." });
    }

    await order.update({ verifiedByManager: true, cookStatus: 'Pending' }); // Set cookStatus to Pending after verification

    // Emit 'orderUpdated' event to inform all clients (chef, customer)
    io.emit('orderUpdated', order); 
    console.log(`Order ${orderId} verified by manager and emitted.`);

    res.status(200).json({ success: true, message: "Order verified successfully!", order });
  } catch (error) {
    console.error("Error verifying order:", error);
    res.status(500).json({ success: false, message: "Failed to verify order." });
  }
};

// Function to get orders for the chef (verified and in active cooking states)
exports.getChefOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: {
        // Removed verifiedByManager: true, so orders appear immediately after payment
        cookStatus: ['Pending', 'Preparing', 'Ready'] // Active states for chef
      },
      order: [['createdAt', 'ASC']] // Oldest first
    });
    res.status(200).json({ success: true, orders }); // Return with success wrapper
  } catch (error) {
    console.error("Error fetching chef orders:", error);
    res.status(500).json({ success: false, message: "Failed to fetch chef orders." });
  }
};


// Function to update an order's cookStatus
exports.updateCookStatus = async (req, res) => {
  const { orderId } = req.params; // Get orderId from URL params
  const { cookStatus } = req.body; // Get new cookStatus from request body

  try {
    const order = await Order.findOne({ where: { orderId } });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Validate new cookStatus against allowed ENUM values
    const allowedStatuses = ["Pending", "Preparing", "Ready", "Served", "Cancelled"];
    if (!allowedStatuses.includes(cookStatus)) {
      return res.status(400).json({ success: false, message: "Invalid cook status provided." });
    }

    order.cookStatus = cookStatus;
    await order.save();

    // Emit 'orderUpdated' event to inform all clients (chef, customer)
    io.emit('orderUpdated', order); 
    console.log(`Emitted orderUpdated for Order ID: ${orderId}, Status: ${cookStatus}`);

    res.status(200).json({ success: true, message: "Order status updated successfully!", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Failed to update order status." });
  }
};

// NEW: Function to automatically cancel old unserved orders
exports.cancelOldUnservedOrders = async () => {
  try {
    const threeHoursAgo = new Date(Date.now() - (3 * 60 * 60 * 1000)); // 3 hours in milliseconds

    const oldOrdersToCancel = await Order.findAll({
      where: {
        cookStatus: {
          [Op.in]: ['Pending', 'Preparing', 'Ready'] // Orders that are still active
        },
        createdAt: {
          [Op.lt]: threeHoursAgo // Orders created before 3 hours ago
        }
      }
    });

    if (oldOrdersToCancel.length > 0) {
      console.log(`Found ${oldOrdersToCancel.length} old unserved orders to cancel.`);
      for (const order of oldOrdersToCancel) {
        await order.update({
          cookStatus: 'Cancelled',
          paymentStatus: 'Refunded' // Assuming a refund process would be initiated for paid orders
        });
        io.emit('orderUpdated', order); // Notify clients about the cancellation
        console.log(`Order ${order.orderId} automatically cancelled due to being unserved for too long.`);
      }
    }
  } catch (error) {
    console.error("Error during automatic order cancellation:", error);
  }
};
