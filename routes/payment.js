const express = require("express");
const { createOrder, verifyPayment } = require("../controllers/paymentController"); // ✅ Import controller functions
require("dotenv").config();

const router = express.Router();

// Route to create Razorpay Order (delegates to controller)
router.post("/create-order", createOrder);

// Route to verify Payment (delegates to controller)
router.post("/verify-payment", verifyPayment);

module.exports = router;