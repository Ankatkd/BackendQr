// backend/testVonageSms.js

// 1. Install the library: npm install @vonage/server-sdk dotenv
// 2. Make sure your .env file is in the backend root with VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_PHONE_NUMBER

require('dotenv').config(); // Load environment variables from .env

const { Vonage } = require('@vonage/server-sdk');

// Initialize the library using credentials from your .env file
const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET
});

// Use your Vonage phone number (the "From" number) from .env
const from = process.env.VONAGE_PHONE_NUMBER;

// IMPORTANT: Replace 'YOUR_RECIPIENT_PHONE_NUMBER' with a real mobile number
// where you want to receive the test SMS. This number must be in E.164 format (e.g., +919876543210).
// If you are on a Vonage trial account, this number MUST be a verified number in your Vonage dashboard.
const to = 'YOUR_RECIPIENT_PHONE_NUMBER_IN_E164_FORMAT'; // e.g., '+919999999999'

const text = 'Hello from Vonage SMS API - Test from your Node.js app!';

async function sendSMS() {
  try {
    const responseData = await vonage.sms.send({ to, from, text });

    // This block handles cases where the promise resolves but the message status is not '0' (success)
    if (responseData.messages && responseData.messages[0]['status'] === "0") {
      console.log('Message sent successfully!');
      console.log(responseData);
    } else {
      console.log('There was an error sending the message.');
      // Log the specific error text from Vonage's response when status is not 0
      console.error('Vonage error-text:', responseData.messages[0]['error-text']);
      console.error('Full Vonage response:', responseData); // Log the full response for more details
    }
  } catch (err) {
    // This block handles cases where the promise rejects (e.g., MessageSendPartialFailure)
    console.log('An unexpected error occurred during SMS sending.');
    if (err.response && err.response.messages && err.response.messages.length > 0) {
      // ✅ MODIFIED: Access the error-text directly from the nested messages array in the caught error object
      console.error('Vonage error-text (from catch):', err.response.messages[0]['error-text']);
      console.error('Full Vonage error response (from catch):', err.response);
    } else {
      // Fallback for other types of errors
      console.error('General error:', err.message);
      console.error(err); // Log the full error object as well
    }
  }
}

sendSMS();
