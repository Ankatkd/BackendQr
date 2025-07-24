// backend/routes/coupon.js
const express = require("express");
const router = express.Router();
const couponController = require("../controllers/couponController");

// Route to get all coupons (if needed, e.g., for admin)
router.get("/", (req, res) => {
    // You might want a controller function for this too, e.g., couponController.getAllCoupons
    res.status(200).json({ message: "Get all coupons endpoint (not yet implemented)" });
});

// ✅ NEW: Route to apply a coupon code
router.post("/apply", couponController.applyCoupon);

module.exports = router;
