// backend/controllers/feedbackController.js
const Feedback = require("../models/feedback.model");

// Controller to submit new feedback (from customer)
exports.submitFeedback = async (req, res) => {
  try {
    const { orderId, phoneNumber, serviceRating, foodRating, priceRating, timeRating, comment } = req.body;

    // Basic validation for required fields
    if (!orderId || !phoneNumber || !serviceRating || !foodRating || !priceRating || !timeRating) {
      return res.status(400).json({ success: false, message: "Order ID, phone number, and all ratings are required." });
    }

    // Check if feedback for this order already exists (since orderId is unique in Feedback model)
    const existingFeedback = await Feedback.findOne({ where: { orderId } });
    if (existingFeedback) {
        return res.status(409).json({ success: false, message: "Feedback for this order has already been submitted." });
    }

    // Create new feedback entry
    const newFeedback = await Feedback.create({
      orderId,
      phoneNumber,
      serviceRating,
      foodRating,
      priceRating,
      timeRating,
      comment: comment || null, // Comment can be optional
      status: 'New', // Default status when customer submits
    });

    res.status(201).json({ success: true, message: "Feedback submitted successfully!", feedback: newFeedback });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    // Handle SequelizeUniqueConstraintError specifically if orderId is duplicated during creation
    if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ success: false, message: "Feedback for this order has already been submitted." });
    }
    res.status(500).json({ success: false, message: "Internal server error submitting feedback." });
  }
};

// Controller to get all feedback (for owner/admin view)
exports.getAllFeedback = async (req, res) => {
  try {
    // If a specific orderId is requested (e.g., from CombinedOrdersView.js check)
    const { orderId } = req.query; 
    let whereClause = {};
    if (orderId) {
      whereClause.orderId = orderId;
    }

    const feedback = await Feedback.findAll({
      where: whereClause, // Apply filter if orderId is present
      order: [['createdAt', 'DESC']] // Order by newest first
    });
    res.status(200).json({ success: true, feedback });
  } catch (error) {
    console.error("Error fetching all feedback:", error);
    res.status(500).json({ success: false, message: "Internal server error fetching feedback." });
  }
};

// Controller to update feedback (add remedy, change status - for owner)
exports.updateFeedbackRemedy = async (req, res) => {
  try {
    const { id } = req.params; // Feedback ID from URL parameter
    const { remedy, status } = req.body; // Remedy text and new status from body

    if (!remedy && !status) { // Require at least one field to update
      return res.status(400).json({ success: false, message: "Remedy or status is required for update." });
    }

    const feedback = await Feedback.findByPk(id);

    if (!feedback) {
      return res.status(404).json({ success: false, message: "Feedback not found." });
    }

    if (remedy !== undefined) {
      feedback.remedy = remedy;
    }
    if (status !== undefined) {
      // Validate status to ensure it's one of the ENUM values from the model
      if (!['New', 'Reviewed', 'Resolved'].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status provided." });
      }
      feedback.status = status;
    }
    
    await feedback.save(); // Save the updated feedback

    res.status(200).json({ success: true, message: "Feedback updated successfully!", feedback });
  } catch (error) {
    console.error("Error updating feedback remedy:", error);
    res.status(500).json({ success: false, message: "Failed to update feedback." });
  }
};

// Controller to generate AI remedy for a specific feedback
exports.generateAiRemedy = async (req, res) => {
  try {
    const { id } = req.params; // Feedback ID from URL parameter

    const feedback = await Feedback.findByPk(id);

    if (!feedback) {
      return res.status(404).json({ success: false, message: "Feedback not found." });
    }

    // Construct a prompt for the AI based on the feedback details
    const prompt = `Generate a polite and empathetic remedy or response for the following customer feedback. 
    The feedback details are:
    Order ID: ${feedback.orderId}
    Phone Number: ${feedback.phoneNumber}
    Service Rating: ${feedback.serviceRating}/5
    Food Rating: ${feedback.foodRating}/5
    Price Rating: ${feedback.priceRating}/5
    Time Rating: ${feedback.timeRating}/5
    Comment: "${feedback.comment || 'No specific comment provided.'}"

    Please provide a concise, actionable, and customer-friendly remedy. Consider apologizing for any inconvenience, acknowledging their ratings, and suggesting a resolution (e.g., a discount on their next order, investigation, or direct contact). The response should be no more than 150 words.`;

    // ✅ FIX: Get API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) {
      console.error("Gemini API key is not set in environment variables.");
      return res.status(500).json({ success: false, message: "Server configuration error: Gemini API key not found." });
    }

    // Call the Gemini API to generate the remedy
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    console.log("DEBUG: Sending request to Gemini API with prompt:", prompt); // Debug Gemini request
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // ✅ ENHANCED DEBUGGING: Log raw response and then the parsed JSON
    console.log("DEBUG: Raw Gemini API response status:", aiResponse.status);
    if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("DEBUG: Raw Gemini API error response text:", errorText);
        return res.status(aiResponse.status).json({ success: false, message: `Gemini API error: ${errorText}` });
    }

    const aiResult = await aiResponse.json();
    console.log("DEBUG: Parsed Gemini API result:", JSON.stringify(aiResult, null, 2)); // Detailed log of AI result

    if (aiResult.candidates && aiResult.candidates.length > 0 &&
        aiResult.candidates[0].content && aiResult.candidates[0].content.parts &&
        aiResult.candidates[0].content.parts.length > 0) {
      const aiRemedy = aiResult.candidates[0].content.parts[0].text;
      res.status(200).json({ success: true, remedy: aiRemedy });
    } else {
      console.error("AI did not return a valid response structure or content is missing:", aiResult);
      res.status(500).json({ success: false, message: "Failed to generate AI remedy: Invalid AI response structure or missing content." });
    }

  } catch (error) {
    console.error("Error generating AI remedy (catch block):", error);
    // Provide more context if possible
    if (error.cause && error.cause.message) {
        res.status(500).json({ success: false, message: `Failed to generate AI remedy: ${error.cause.message}` });
    } else {
        res.status(500).json({ success: false, message: error.message || "Failed to generate AI remedy. Please try again." });
    }
  }
};
