const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { sequelize } = require("./config/config");
const http = require('http');
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000", // Local dev
  "https://frontendqr-drv8.onrender.com"
];

// Apply CORS for API routes
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

const server = http.createServer(app);

// Apply same CORS config for Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
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
const { Payment } = require("./models/payment");
const Table = require("./models/tables");
const Coupon = require("./models/coupon");
const Otp = require("./models/otp.model");
const Feedback = require("./models/feedback.model");

// Import Routes
const paymentRoutes = require("./routes/payment");
const couponRoutes = require("./routes/coupon");
const orderRoutes = require("./routes/order");
const authRoutes = require("./routes/auth");
const feedbackRoutes = require("./routes/feedback");
const reportRoutes = require("./routes/reportRoutes");

const orderController = require("./controllers/orderController");

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/reports", reportRoutes);

app.get("/", (req, res) => {
  res.send("QRMenu Backend API is running!");
});

// Database sync & server start
const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection has been established successfully.");

    await User.sync({ alter: true });
    await Order.sync({ alter: true });
    await Payment.sync({ alter: true });
    await Table.sync({ force: true });
    await Coupon.sync({ force: true });
    await Otp.sync({ alter: true });
    await Feedback.sync({ alter: true });

    console.log("✅ All Database Models Synced");

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT} (accessible via local network IP)`);
      setInterval(orderController.cancelOldUnservedOrders, 15 * 60 * 1000);
      console.log("Scheduled automatic old order cancellation every 15 minutes.");
    });
  } catch (err) {
    console.error("❌ Unable to connect to the database or sync models:", err);
    process.exit(1);
  }
};

syncDatabase();
