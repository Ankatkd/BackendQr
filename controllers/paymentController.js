// backend/controllers/paymentController.js
const Razorpay = require("razorpay");
const crypto = require("crypto");
// Import Sequelize helper functions from models/payment.js
const {
  Payment, // Import the Payment model itself
  getNextCustomOrderId,
  createInitialPaymentRecord,
  updatePaymentStatusAndId,
} = require("../models/payment");
const Order = require("../models/orders"); // Import the Order model
require("dotenv").config();

// ✅ Import the Socket.IO instance - THIS IS THE FIX FOR "io is not defined"
const { io } = require('../server'); 

// Initialize Razorpay instance with credentials from .env
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Controller function to create a Razorpay Order
exports.createOrder = async (req, res) => {
  let customOrderId = null;
  let paymentRecord = null;
  let orderRecord = null;

  try {
    const { phoneNumber, amount, tableNumber, selectedItems, note } = req.body;

    console.log("📦 Request body received for create-order:", req.body); // Frontend request body
    console.log("DEBUG: Extracted phoneNumber from req.body:", phoneNumber); // Debug extracted phoneNumber

    // Basic validation
    if (!phoneNumber || !amount || !tableNumber || !selectedItems || selectedItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Phone number, amount, table number, and selected items are required",
      });
    }
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be greater than zero.",
      });
    }

    // 1. Prepare options for Razorpay order creation.
    const options = {
      amount: Math.round(amount * 100), // Amount in paise
      currency: "INR",
      receipt: `temp_receipt_${Date.now()}`, // Temporary receipt
      payment_capture: 1, // Auto-capture the payment if successful
      notes: {
        table_number: tableNumber,
        phone_number: phoneNumber,
      },
    };

    // 2. Create the order with Razorpay FIRST.
    const razorpayOrder = await razorpay.orders.create(options);
    console.log("✅ Razorpay Order created:", razorpayOrder);

    // 3. NOW, if Razorpay order creation was successful, generate your customOrderId.
    customOrderId = await getNextCustomOrderId();
    console.log("✅ CustomOrderId generated:", customOrderId);

    // Optional: Update the Razorpay order with the real customOrderId as receipt.
    try {
      await razorpay.orders.edit(razorpayOrder.id, { receipt: customOrderId });
      console.log(`✅ Razorpay Order ${razorpayOrder.id} updated with custom receipt: ${customOrderId}`);
    } catch (editError) {
      console.warn(`❗ Failed to update Razorpay order receipt with customOrderId: ${customOrderId}. Error: ${editError.message}`);
    }

    // 4. Create the initial Payment record in your database.
    const paymentResult = await createInitialPaymentRecord(
      phoneNumber,
      amount,
      tableNumber,
      razorpayOrder.id, // razorpayOrderId is available now
      "Pending", // Initial status for payment record
      customOrderId // Pass the generated customOrderId
    );
    paymentRecord = paymentResult.paymentRecord;

    console.log("✅ Initial Payment record created with customOrderId:", customOrderId);

    // 5. Create the Order record in your database.
    console.log("DEBUG: Attempting to create Order with phoneNumber:", phoneNumber); // DEBUG: Check phoneNumber right before Order.create
    orderRecord = await Order.create({
      orderId: customOrderId, // Link to your custom order ID
      tableNumber: tableNumber,
      items: selectedItems, // Sequelize model's setter will stringify this
      totalAmount: amount,
      note: note || '',
      phoneNumber: String(phoneNumber), // Explicitly cast to String here
      paymentStatus: 'Pending', // Initial status for order record
      cookStatus: 'Pending', // Initial cook status for order record
      verifiedByManager: false,
    });
    console.log("✅ Order record created for customOrderId:", customOrderId);

    res.status(200).json({
      success: true,
      orderId: razorpayOrder.id, // This is Razorpay's order ID
      customOrderId: customOrderId, // This is your custom formatted ID
      amount: razorpayOrder.amount / 100, // Send back in rupees
      currency: razorpayOrder.currency,
      tableNumber,
      selectedItems, // Send back for confirmation page consistency
    });
  } catch (error) {
    console.error("❌ Error creating Razorpay order:", error);

    // Rollback logic:
    if (paymentRecord && paymentRecord.status === "Pending") {
      await paymentRecord.update({ status: "Failed" }).catch(e => console.error("Failed to update initial payment status to Failed during rollback:", e));
    }
    if (orderRecord && orderRecord.paymentStatus === "Pending") {
      await orderRecord.update({ paymentStatus: "Failed", cookStatus: "Cancelled" }).catch(e => console.error("Failed to update order record status to Failed during rollback:", e));
    }

    // Be more specific with error message if it's a validation error
    if (error.name === 'SequelizeValidationError') {
      const fieldErrors = error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ success: false, error: `Validation Error: ${fieldErrors}` });
    }
    res.status(500).json({
      success: false,
      error: "Failed to create order",
      details: error?.description || error.message,
    });
  }
};

// Controller function to verify payment and update status (Server-Side Verification)
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customOrderId } = req.body;

    console.log("📦 Request body received for verify-payment:", req.body);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !customOrderId) {
      return res.status(400).json({
        success: false,
        error: "Missing payment verification details",
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      try {
        console.log("DEBUG: Attempting to fetch Razorpay payment details for:", razorpay_payment_id);
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        const paymentStatusForDB = paymentDetails.status === "captured" ? "Paid" : "Failed";
        console.log("DEBUG: Fetched payment details:", paymentDetails);
        console.log("DEBUG: Payment status for DB:", paymentStatusForDB);

        console.log("DEBUG: Attempting to update Payment record with:", razorpay_order_id, paymentStatusForDB, razorpay_payment_id);
        const updateResult = await updatePaymentStatusAndId(
          razorpay_order_id,
          paymentStatusForDB,
          razorpay_payment_id // Ensure payment_id is passed for update
        );
        console.log("DEBUG: Update Payment record result:", updateResult);

        if (!updateResult.success) {
          console.warn(`Payment record for order ${razorpay_order_id} not found during verification update.`);
          return res.status(404).json({ success: false, error: "Payment record not found" });
        }

        console.log("DEBUG: Attempting to find Order record for customOrderId:", customOrderId);
        const order = await Order.findOne({ where: { orderId: customOrderId } });
        console.log("DEBUG: Found Order record:", order);

        if (order) {
          console.log("DEBUG: Attempting to update Order status.");
          await order.update({
            paymentStatus: paymentStatusForDB,
            cookStatus: paymentStatusForDB === "Paid" ? "Pending" : "Cancelled"
          });
          console.log(`✅ Order status updated for orderId: ${customOrderId}`);
          // Emit real-time update for the order
          io.emit('orderStatusUpdate', order); // ✅ This line should now work
        } else {
          console.warn(`Order record for customOrderId ${customOrderId} not found during payment verification.`);
        }

        res.status(200).json({
          success: true,
          message: "✅ Payment verified and status updated successfully!",
          paymentStatus: paymentStatusForDB,
          customOrderId: customOrderId,
        });

      } catch (fetchError) {
        // ✅ ENHANCED ERROR LOGGING HERE
        console.error("❌ Critical Error during Razorpay fetch or DB update in verifyPayment:", fetchError);
        console.error("Error name:", fetchError.name);
        console.error("Error message:", fetchError.message);
        if (fetchError.response) { // Axios error response
            console.error("Error response data:", fetchError.response.data);
            console.error("Error response status:", fetchError.response.status);
            console.error("Error response headers:", fetchError.response.headers);
        } else if (fetchError.parent) { // Sequelize error parent
            console.error("Sequelize parent error:", fetchError.parent);
        }
        
        // Attempt to update status to Failed for payment and order records
        await updatePaymentStatusAndId(razorpay_order_id, "Failed", razorpay_payment_id)
          .catch(e => console.error("Failed to update status to failed after Razorpay fetch error:", e));
        await Order.update({ paymentStatus: "Failed", cookStatus: "Cancelled" }, { where: { orderId: customOrderId } })
          .catch(e => console.error("Failed to update order status to failed after Razorpay fetch error:", e));
        
        res.status(500).json({ success: false, message: "Payment verification failed due to an internal server error. Please contact support." });
      }

    } else {
      console.warn("❗ Payment signature mismatch for order:", razorpay_order_id);
      await updatePaymentStatusAndId(razorpay_order_id, "Failed", razorpay_payment_id)
        .catch(e => console.error("Failed to update status to failed after signature mismatch:", e));
      await Order.update({ paymentStatus: "Failed", cookStatus: "Cancelled" }, { where: { orderId: customOrderId } })
        .catch(e => console.error("Failed to update order status to failed after signature mismatch:", e));
      res.status(400).json({ success: false, message: "Invalid payment signature." });
    }
  } catch (error) {
    console.error("❌ General Payment verification error (top-level catch):", error);
    res.status(500).json({ success: false, message: "Payment verification failed due to an unexpected error." });
  }
};
