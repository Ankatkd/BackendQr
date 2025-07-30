// backend/routes/order.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Route to create a new order (used by customer after payment)
router.post("/", orderController.createOrder);

// Route to get all orders (can be filtered by phoneNumber for customer history)
router.get("/", orderController.getAllOrders);

// Route for manager to get orders pending verification
router.get("/pending-verification", orderController.getPendingVerificationOrders);

// Route for manager to verify an order
router.put("/verify", orderController.verifyOrder); // Using PUT for update

// Route for chef to get orders that are verified and in active cooking states
router.get("/verified", orderController.getChefOrders); // This is the route that was 404ing

// Route to update an order's cookStatus (used by chef)
router.put("/:orderId/status", orderController.updateCookStatus);

module.exports = router;
