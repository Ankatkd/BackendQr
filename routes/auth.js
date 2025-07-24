// backend/routes/auth.js
const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");

// --- Authentication Routes ---
router.post("/request-otp", authController.requestOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/check-user", authController.checkUser);
router.post("/register-or-update", authController.registerOrUpdate);
router.post("/login", authController.login);

// ✅ NEW: Routes for User Profile - ENSURE THESE ARE PRESENT
router.get("/profile", authController.getUserProfile); // Get user profile by phone number
router.put("/profile", authController.updateUserProfile); // Update user profile

module.exports = router;
