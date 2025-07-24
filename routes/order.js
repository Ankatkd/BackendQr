// backend/routes/order.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Route to get all orders
router.get("/", orderController.getAllOrders);

// Route to update an order's cook status
router.put("/:orderId/status", orderController.updateCookStatus);

module.exports = router;
