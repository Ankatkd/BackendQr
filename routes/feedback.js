// backend/routes/feedback.js
const express = require("express");
const router = express.Router();
const feedbackController = require("../controllers/feedbackController");

// Route for users to submit new feedback
router.post("/", feedbackController.submitFeedback);

// Route for owners/admins to get all feedback (and filter by orderId if provided)
router.get("/", feedbackController.getAllFeedback);

// Route for owners/admins to update feedback (add remedy, change status)
router.put("/:id/remedy", feedbackController.updateFeedbackRemedy);

// NEW: Route for owners/admins to generate AI remedy for a specific feedback
router.post("/:id/ai-remedy", feedbackController.generateAiRemedy);

module.exports = router;
