// backend/controllers/authController.js
const User = require("../models/user.model");
const Otp = require("../models/otp.model");
const bcrypt = require("bcryptjs");
const otpGenerator = require("otp-generator");
const jwt = require('jsonwebtoken'); // NEW: Import jsonwebtoken
require('dotenv').config();

const { Vonage } = require('@vonage/server-sdk');

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET
});
const VONAGE_PHONE_NUMBER = process.env.VONAGE_PHONE_NUMBER;

function getIpAddress(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return forwarded ? forwarded.split(",")[0] : req.connection.remoteAddress;
}

exports.requestOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const otpCode = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    // Use upsert to create or update the OTP record for the phone number
    await Otp.upsert(
      { phoneNumber, otpCode, expiresAt },
      { where: { phoneNumber } }
    );

    const toPhoneNumberE164 = `+91${phoneNumber}`; 
    const fromPhoneNumber = VONAGE_PHONE_NUMBER;
    const smsText = `Your OTP for QRMenu is: ${otpCode}. It expires in 5 minutes.`;

    // Ensure Vonage API key/secret are configured
    if (!fromPhoneNumber || !vonage.apiKey || !vonage.apiSecret) {
        console.warn('Vonage API credentials not fully configured. OTP not sent via SMS.');
        console.log(`OTP for ${phoneNumber}: ${otpCode} (for testing without Vonage)`);
        return res.status(200).json({ success: true, message: "OTP generated (Vonage not configured)." });
    }

    const responseData = await vonage.sms.send({ to: toPhoneNumberE164, from: fromPhoneNumber, text: smsText });

    if (responseData.messages && responseData.messages[0]['status'] === "0") {
      console.log(`OTP ${otpCode} sent to ${toPhoneNumberE164} via Vonage.`);
      console.log("DEBUG: Vonage SMS sent successfully, sending HTTP response.");
      res.status(200).json({ success: true, message: "OTP sent successfully!" });
    } else {
      const errorMessage = responseData.messages[0]['error-text'] || "Unknown Vonage error";
      console.error(`Vonage SMS failed for ${toPhoneNumberE164} with error: ${errorMessage}`);
      console.error('Full Vonage response:', responseData);
      res.status(500).json({ success: false, message: `Failed to send OTP: ${errorMessage}` });
    }

  } catch (error) {
    console.error("Error requesting OTP (general catch block):", error);
    
    if (error.response && error.response.messages && error.response.messages.length > 0) {
        const vonageErrorMessage = error.response.messages[0]['error-text'] || "Unknown Vonage error";
        return res.status(500).json({ success: false, message: `Failed to send OTP: ${vonageErrorMessage}` });
    }
    res.status(500).json({ success: false, message: error.message || "Failed to send OTP. Please try again." });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ success: false, message: "Phone number and OTP are required." });
    }

    const otpRecord = await Otp.findOne({ where: { phoneNumber } });

    if (!otpRecord || otpRecord.otpCode !== otp || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }

    await otpRecord.destroy(); // OTP used, delete it

    // Find or create user after successful OTP verification
    let user = await User.findOne({ where: { phoneNumber } });

    if (!user) {
        // If user doesn't exist, create them with a default role (e.g., 'customer')
        // You might want to prompt for password/name during registration flow later
        user = await User.create({
            phoneNumber,
            role: 'customer', // Default role for new users via OTP
            // You might add a default password or mark as 'password_less' if needed
        });
        console.log(`New user ${phoneNumber} registered via OTP.`);
    }

    // Generate JWT token for the user
    const token = jwt.sign(
        { id: user.id, role: user.role, phoneNumber: user.phoneNumber },
        process.env.JWT_SECRET,
        { expiresIn: '1h' } // Token expires in 1 hour
    );

    res.status(200).json({ 
        success: true, 
        message: "OTP verified successfully!",
        token,
        user: {
            id: user.id,
            name: user.name, // Will be null if not set during registration
            phoneNumber: user.phoneNumber,
            role: user.role,
        },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ success: false, message: "Internal server error during OTP verification." });
  }
};

exports.registerOrUpdate = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({ success: false, message: "Phone number and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
    }

    const ipAddress = getIpAddress(req);
    const hashedPassword = await bcrypt.hash(password, 10);

    let user = await User.findOne({ where: { phoneNumber } });

    if (user) {
      await user.update({ password: hashedPassword, ipAddress });
      console.log(`User ${phoneNumber} password updated.`);
      
      // Generate new token after password update, as old one might be based on old user state
      const token = jwt.sign(
        { id: user.id, role: user.role, phoneNumber: user.phoneNumber },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return res.status(200).json({
        success: true,
        message: "Password updated successfully!",
        token,
        user: { id: user.id, phoneNumber: user.phoneNumber, role: user.role },
      });
    } else {
      user = await User.create({
        phoneNumber,
        password: hashedPassword,
        role: 'customer',
        ipAddress,
      });
      console.log(`New user ${phoneNumber} registered.`);

      // Generate token for the newly registered user
      const token = jwt.sign(
        { id: user.id, role: user.role, phoneNumber: user.phoneNumber },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return res.status(201).json({
        success: true,
        message: "Account created successfully!",
        token,
        user: { id: user.id, phoneNumber: user.phoneNumber, role: user.role },
      });
    }
  } catch (error) {
    console.error("Error in registerOrUpdate:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ success: false, message: "Phone number already registered." });
    }
    res.status(500).json({ success: false, message: "Internal server error during registration/update." });
  }
};

exports.checkUser = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const user = await User.findOne({ where: { phoneNumber } });

    if (user) {
      return res.status(200).json({ success: true, exists: true, user: { role: user.role } });
    } else {
      return res.status(200).json({ success: true, exists: false });
    }
  } catch (error) {
    console.error("Error checking user existence:", error);
    res.status(500).json({ success: false, message: "Internal server error during user check." });
  }
};

exports.login = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !password) {
      return res.status(400).json({ success: false, message: "Phone number and password are required." });
    }

    const user = await User.findOne({ where: { phoneNumber } });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid phone number or password." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid phone number or password." });
    }

    // Generate JWT token on successful login
    const token = jwt.sign(
        { id: user.id, role: user.role, phoneNumber: user.phoneNumber },
        process.env.JWT_SECRET,
        { expiresIn: '1h' } // Token expires in 1 hour
    );

    res.status(200).json({
      success: true,
      message: "Login successful!",
      token, // Send token to frontend
      user: { id: user.id, phoneNumber: user.phoneNumber, role: user.role, name: user.name }, // Include user name
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Internal server error during login." });
  }
};

// NEW: Verify Token endpoint for persistent login
exports.verifyToken = async (req, res) => {
    const { token, phoneNumber } = req.body; // Expect token and phoneNumber from frontend

    if (!token || !phoneNumber) {
        return res.status(400).json({ success: false, message: 'Token and phone number are required.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ensure the decoded token matches the provided phone number
        if (decoded.phoneNumber !== phoneNumber) {
            return res.status(401).json({ success: false, message: 'Token does not match user.' });
        }

        const user = await User.findByPk(decoded.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Return user data (excluding password)
        res.status(200).json({
            success: true,
            message: 'Token verified.',
            user: {
                id: user.id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                role: user.role,
            },
        });

    } catch (error) {
        console.error('Token verification failed:', error.message);
        // Handle various JWT errors (e.g., TokenExpiredError, JsonWebTokenError)
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};

// ✅ NEW: Function to get user profile data
exports.getUserProfile = async (req, res) => {
  try {
    // Get phone number from authenticated user (assuming middleware sets req.user or from query)
    // For this example, we'll continue to use query param as per your original code
    const { phoneNumber } = req.query; 
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const user = await User.findOne({ 
      where: { phoneNumber },
      attributes: ['id', 'name', 'email', 'phoneNumber', 'alternativeContact', 'address', 'role'] // Select specific attributes
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ success: false, message: "Internal server error fetching profile." });
  }
};

// ✅ NEW: Function to update user profile data
exports.updateUserProfile = async (req, res) => {
  try {
    const { phoneNumber, name, email, alternativeContact, address } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const user = await User.findOne({ where: { phoneNumber } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Update only the fields that are provided and allowed to be updated
    await user.update({
      name: name !== undefined ? name : user.name,
      email: email !== undefined ? email : user.email,
      alternativeContact: alternativeContact !== undefined ? alternativeContact : user.alternativeContact,
      address: address !== undefined ? address : user.address,
      // Do NOT update password here. Password updates should go through registerOrUpdate or a dedicated password reset.
    });

    res.status(200).json({ success: true, message: "Profile updated successfully!", user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      alternativeContact: user.alternativeContact,
      address: user.address,
      role: user.role
    }});
  } catch (error) {
    console.error("Error updating user profile:", error);
    // Handle unique constraint errors for email if it's unique
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: "Email already in use by another account." });
    }
    res.status(500).json({ success: false, message: "Internal server error updating profile." });
  }
};
