require("dotenv").config();
const axios = require("axios");

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;

async function testToken() {
  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    console.log("Access token:", response.data.access_token);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

testToken();
