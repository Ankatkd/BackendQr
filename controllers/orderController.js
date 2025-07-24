// backend/controllers/orderController.js
const Order = require("../models/orders");
const { io } = require("../server");

// Helper to generate a simple unique Order ID
const generateOrderId = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
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
      items,
      totalAmount,
      note: note || null,
      phoneNumber, // ✅ Save phoneNumber with the order
      cookStatus: 'Pending',
      paymentStatus: 'Pending',
    });

    io.emit('orderStatusUpdate', newOrder); 
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
      where: whereClause // Apply the filter
    });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: "Failed to fetch orders." });
  }
};

// Function to update an order's cookStatus
exports.updateCookStatus = async (req, res) => {
  const { orderId } = req.params;
  const { cookStatus } = req.body;

  try {
    const order = await Order.findOne({ where: { orderId } });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    order.cookStatus = cookStatus;
    await order.save();

    io.emit('orderStatusUpdate', order); 
    console.log(`Emitted orderStatusUpdate for Order ID: ${orderId}, Status: ${cookStatus}`);

    res.status(200).json({ success: true, message: "Order status updated successfully!", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Failed to update order status." });
  }
};
