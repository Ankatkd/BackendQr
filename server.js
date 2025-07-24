// backend/server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { sequelize } = require("./config/config");
const http = require('http');
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // ⭐ FIX: Allow connections from your frontend's IP address (port 3000)
    // For local development on your network, use your computer's IP address
    origin: ["http://localhost:3000", "http://192.168.8.58:3000"], // Add your computer's IP for phone access
    // Or for broadest testing (not recommended for production):
    // origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

module.exports.io = io; 

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Import Models
const User = require("./models/user.model");
const Order = require("./models/orders");
const { Payment } = require("./models/payment"); // Destructure Payment as it's an object now
const Table = require("./models/tables");
const Coupon = require("./models/coupon");
const Otp = require("./models/otp.model");
const Feedback = require("./models/feedback.model"); // ✅ NEW: Import Feedback model

app.use(cors());
app.use(express.json());

// Import Routes
const paymentRoutes = require("./routes/payment");
const couponRoutes = require("./routes/coupon");
const orderRoutes = require("./routes/order");
const authRoutes = require("./routes/auth");
const feedbackRoutes = require("./routes/feedback"); // ✅ NEW: Import Feedback routes
const reportRoutes = require("./routes/reportRoutes");     // ✅ NEW: Import Report routes

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/order", orderRoutes); 
app.use("/api/feedback", feedbackRoutes); // ✅ NEW: Mount Feedback routes
app.use("/api/reports", reportRoutes);   // ✅ NEW: Mount Report routes

app.get("/", (req, res) => {
  res.send("QRMenu Backend API is running!");
});

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection has been established successfully.");

    // Sync all models. Order matters for foreign keys if any.
    await User.sync({ alter: true });
    await Order.sync({ alter: true });
    await Payment.sync({ alter: true });
    // ⭐ FIX: Use force: true for Table.sync to ensure a clean recreation.
    // WARNING: This will drop and recreate the 'tables' table on every server restart,
    // losing all existing data in that table. DO NOT USE IN PRODUCTION.
    await Table.sync({ force: true }); 
    // ⭐ FIX: Use force: true for Coupon.sync to ensure a clean recreation.
    // WARNING: This will drop and recreate the 'coupons' table on every server restart,
    // losing all existing data in that table. DO NOT USE IN PRODUCTION.
    await Coupon.sync({ force: true }); 
    await Otp.sync({ alter: true });
    await Feedback.sync({ alter: true }); // ✅ NEW: Sync Feedback model

    console.log("✅ All Database Models Synced");

    server.listen(PORT, '0.0.0.0', () => { // Make sure '0.0.0.0' is present here
  console.log(`🚀 Server running on port ${PORT} (accessible via local network IP)`);
    });
  } catch (err) {
    console.error("❌ Unable to connect to the database or sync models:", err);
    process.exit(1);
  }
};

syncDatabase();
