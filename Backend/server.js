// ------------------------
// server.js
// ------------------------
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ------------------------
// Daraja Credentials
// ------------------------
const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const shortcode = process.env.SHORTCODE;
const lipaNaMpesaOnlinePasskey = process.env.PASSKEY;
const callbackUrl = process.env.CALLBACK_URL;

// ------------------------
// In-memory payment store
// ------------------------
const payments = {}; // { checkoutRequestId: { status, phone, amount, customerName, accountReference } }

// ------------------------
// Helper: Generate Access Token
// ------------------------
async function getAccessToken() {
  console.log("Generating access token...");
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  console.log("Access token generated:", response.data.access_token);
  return response.data.access_token;
}

// ------------------------
// STK Push Endpoint
// ------------------------
app.post("/stkpush", async (req, res) => {
  try {
    const { phone, amount, accountReference, customerName } = req.body;
    console.log("Received STK Push request:", req.body);

    const accessToken = await getAccessToken();

    const timestamp = new Date().toISOString().replace(/[-T:Z.]/g, "").slice(0, 14);
    const password = Buffer.from(shortcode + lipaNaMpesaOnlinePasskey + timestamp).toString("base64");

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: `Payment for carwash by ${customerName}`
    };

    console.log("Sending STK Push payload to Daraja:", stkPayload);

    const stkResponse = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      stkPayload,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log("Daraja STK Push response:", stkResponse.data);

    const checkoutRequestId = stkResponse.data.CheckoutRequestID;
    console.log("CheckoutRequestID:", checkoutRequestId);

    // Save to in-memory store as "pending"
    payments[checkoutRequestId] = {
      status: "pending",
      phone,
      amount,
      customerName,
      accountReference
    };

    console.log("Payment saved in-memory as pending:", payments[checkoutRequestId]);

    res.json({ success: true, checkoutRequestId });

  } catch (err) {
    console.error("Error sending STK Push:", err.response?.data || err.message);
    res.json({ success: false, message: "Error sending STK Push" });
  }
});

// ------------------------
// Daraja Callback
// ------------------------
// ------------------------
// Daraja Callback
// ------------------------
app.post("/mpesa-callback", (req, res) => {
  try {
    console.log("Received STK callback:", JSON.stringify(req.body, null, 2));

    const callbackData = req.body.Body.stkCallback;
    const checkoutRequestId = callbackData.CheckoutRequestID;

    // Daraja sends ResultCode (number) for success/failure
    const resultCode = Number(callbackData.ResultCode);

    if (resultCode === 0) {
      // Payment successful
      const amountItem = callbackData.CallbackMetadata?.Item?.find(i => i.Name === "Amount");
      const phoneItem = callbackData.CallbackMetadata?.Item?.find(i => i.Name === "PhoneNumber");
      const receiptItem = callbackData.CallbackMetadata?.Item?.find(i => i.Name === "MpesaReceiptNumber");

      const amount = amountItem ? amountItem.Value : 0;
      const phone = phoneItem ? phoneItem.Value : "Unknown";
      const receipt = receiptItem ? receiptItem.Value : "Unknown";

      console.log(`Payment SUCCESS for ${checkoutRequestId}: Phone ${phone}, Amount ${amount}, Receipt ${receipt}`);

      // Update in-memory store
      if (payments[checkoutRequestId]) {
        payments[checkoutRequestId].status = "completed";
        payments[checkoutRequestId].receipt = receipt;
        payments[checkoutRequestId].amount = amount;
        console.log("Updated in-memory payment store:", payments[checkoutRequestId]);
      } else {
        console.warn("CheckoutRequestID not found in in-memory store:", checkoutRequestId);
      }

      // Respond to Daraja
      res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });
    } else {
      // Payment failed
      console.log(`Payment FAILED for ${checkoutRequestId}:`, callbackData);

      if (payments[checkoutRequestId]) {
        payments[checkoutRequestId].status = "failed";
        console.log("Updated in-memory payment store as failed:", payments[checkoutRequestId]);
      }

      res.status(200).json({ ResultCode: 0, ResultDesc: "Received" });
    }
  } catch (err) {
    console.error("Error handling STK callback:", err);
    res.status(500).json({ ResultCode: 1, ResultDesc: "Error" });
  }
});



// ------------------------
// Check Payment Status Endpoint
// ------------------------
app.get("/payment-status/:checkoutRequestId", (req, res) => {
  const id = req.params.checkoutRequestId;
  const payment = payments[id];
  console.log("Checking payment status for:", id, payment);
  if (!payment) return res.json({ success: false, message: "Payment not found" });

  res.json({ success: true, status: payment.status, phone: payment.phone, amount: payment.amount });
});

// ------------------------
// Start Server
// ------------------------
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
