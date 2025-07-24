// backend/routes/phoneAuth.js
const express = require("express");
const router = express.Router();
// const User = require("../models/user.model"); // No longer needed directly here
const os = require("os"); // Not strictly needed in routes, better in controller if used
const admin = require("firebase-admin");
const serviceAccount = require("../config/serviceAccountKey.json");

// Import the new controller functions
const phoneAuthController = require("../controllers/authController");

// Initialize Firebase Admin SDK (Keep this here if you use it for other admin tasks,
// otherwise, it could be moved to the controller if only used there.)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

// Utility to get IP Address (Moved to controller, but kept here for reference if needed)
// function getIpAddress(req) {
//     const forwarded = req.headers["x-forwarded-for"];
//     return forwarded ? forwarded.split(",")[0] : req.connection.remoteAddress;
// }

// Original save-user endpoint (if still needed, otherwise consider removing)
// Frontend PhoneLogin.js was calling this after OTP verification.
// Now, it's calling /check-user and /register-or-update.
// If you want to keep this, ensure its logic aligns with the new flow.
// For now, I'm mapping it to the controller's saveUser function.
router.post("/save-user", authController.saveUser);


// NEW: Route to check if a user exists by phone number
router.post("/check-user", authController.checkUser);

// NEW: Route to register a new user or update an existing user's password
router.post("/register-or-update", authController.registerOrUpdate);


module.exports = router;
