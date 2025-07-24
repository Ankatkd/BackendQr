// backend/controllers/authController.js
const User = require("../models/user.model");
const Otp = require("../models/otp.model");
const bcrypt = require("bcryptjs");
const otpGenerator = require("otp-generator");
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
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.upsert(
      { phoneNumber, otpCode, expiresAt },
      { where: { phoneNumber } }
    );

    const toPhoneNumberE164 = `+91${phoneNumber}`; 
    const fromPhoneNumber = VONAGE_PHONE_NUMBER;
    const smsText = `Your OTP for QRMenu is: ${otpCode}. It expires in 5 minutes.`;

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

    await otpRecord.destroy();

    res.status(200).json({ success: true, message: "OTP verified successfully!" });
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
      return res.status(200).json({
        success: true,
        message: "Password updated successfully!",
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
      return res.status(201).json({
        success: true,
        message: "Account created successfully!",
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

    res.status(200).json({
      success: true,
      message: "Login successful!",
      user: { id: user.id, phoneNumber: user.phoneNumber, role: user.role },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Internal server error during login." });
  }
};

// ✅ NEW: Function to get user profile data
exports.getUserProfile = async (req, res) => {
  try {
    const { phoneNumber } = req.query; // Assuming phoneNumber is passed as a query parameter
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
