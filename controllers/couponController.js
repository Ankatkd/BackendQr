// backend/controllers/couponController.js
const Coupon = require('../models/coupon'); // Assuming your Coupon model is defined here
const { Op } = require('sequelize'); // Import Op for Sequelize operators

exports.applyCoupon = async (req, res) => {
    const { couponCode, originalAmount } = req.body;

    if (!couponCode || originalAmount === undefined || originalAmount < 0) {
        return res.status(400).json({ success: false, message: "Invalid request data for coupon application." });
    }

    try {
        const coupon = await Coupon.findOne({
            where: {
                code: couponCode.toUpperCase(), // Store and compare coupon codes in uppercase
                isActive: true,
                // Check if validUntil is null (no expiry) or in the future
                [Op.or]: [
                    { validUntil: { [Op.gte]: new Date() } },
                    { validUntil: null }
                ]
            }
        });

        if (!coupon) {
            return res.status(400).json({ success: false, message: "Invalid or expired coupon code." });
        }

        let finalAmount = originalAmount;

        // Apply discount based on type
        if (coupon.discountType === 'fixed') {
            finalAmount = originalAmount - coupon.discountAmount;
        } else if (coupon.discountType === 'percentage') {
            finalAmount = originalAmount * (1 - coupon.discountAmount / 100);
        }

        // Ensure final amount is not negative
        finalAmount = Math.max(0, finalAmount);

        // --- Specific logic for 'TODAY20' (only on Thursdays) ---
        if (coupon.code === 'TODAY20') {
            const today = new Date();
            // getDay() returns 0 for Sunday, 1 for Monday, ..., 4 for Thursday, ..., 6 for Saturday
            if (today.getDay() !== 4) { // 4 represents Thursday
                // If it's not Thursday, the coupon is not valid
                return res.status(400).json({ success: false, message: "The 'TODAY20' coupon is only valid on Thursdays." });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Coupon applied successfully!",
            finalAmount: finalAmount,
            discountAmount: originalAmount - finalAmount // Send the actual discount amount
        });

    } catch (error) {
        console.error("Error applying coupon:", error);
        return res.status(500).json({ success: false, message: "An internal server error occurred while applying the coupon." });
    }
};
