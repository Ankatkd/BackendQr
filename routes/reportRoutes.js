// backend/routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController"); // Ensure this path is correct

// Route for Monthly Sales Report
router.get("/monthly-sales", reportController.getMonthlySalesReport);

// Route for Daily Sales Report and Popular Items (now includes date filter and daily transactions)
router.get("/daily-sales", reportController.getDailySalesAndTransactionsReport); 

// Route for Today's Transactions (renamed to avoid confusion with enhanced daily-sales)
router.get("/transactions", reportController.getTodaysTransactions);

module.exports = router;
