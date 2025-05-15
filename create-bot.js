// Utility script to directly create a bot using the Vexa API
const fetch = require("node-fetch");

// Use the API key from your background.js
const API_KEY = ""; // Replace with your actual API key if needed
const BASE_URL = "https://gateway.dev.vexa.ai";

// Meeting details
const MEETING_ID = "vyt-zxze-ijh"; // The meeting ID from your error message
const LANGUAGE = "en";
const BOT_NAME = "TestBot";

async function createBot() {
  console.log(`\nAttempting to create a bot for meeting: ${MEETING_ID}`);
  console.log(`Language: ${LANGUAGE}`);
  console.log(`Bot name: ${BOT_NAME}`);

  try {
    const response = await fetch(`${BASE_URL}/bots`, {
      method: "POST",
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: "google_meet",
        native_meeting_id: MEETING_ID,
        language: LANGUAGE,
        bot_name: BOT_NAME,
      }),
    });

    console.log(`Response status: ${response.status}`);

    const responseText = await response.text();
    console.log(`Response body: ${responseText}`);

    if (!response.ok) {
      console.error(`Error creating bot: ${response.status}`);

      try {
        const errorData = JSON.parse(responseText);
        if (
          errorData.detail &&
          errorData.detail.includes("maximum concurrent bot limit")
        ) {
          console.log("\n=== CONCURRENT BOT LIMIT DETECTED ===");
          console.log(
            "This confirms that according to the Vexa API server, your account has reached the maximum concurrent bot limit."
          );
          console.log(
            "However, our previous checks showed you don't have any active bots or meetings."
          );
          console.log("\nPossible solutions:");
          console.log(
            "1. Contact Vexa support to investigate this discrepancy"
          );
          console.log(
            "2. Check if you're using the same API key in other applications or services"
          );
          console.log("3. Try using a different API key if available");
          console.log(
            "4. Wait 24-48 hours for any orphaned bots to automatically time out"
          );
        }
      } catch (e) {
        console.error("Failed to parse error response as JSON:", e);
      }

      return;
    }

    console.log("\nBot created successfully!");

    // Parse the response
    try {
      const data = JSON.parse(responseText);
      console.log("\nBot Details:");
      console.log(`Bot ID: ${data.id || "unknown"}`);
      console.log(`Meeting ID: ${data.native_meeting_id || "unknown"}`);
      console.log(`Status: ${data.status || "unknown"}`);
      console.log(`Language: ${data.language || "unknown"}`);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
    }
  } catch (error) {
    console.error("Error creating bot:", error);
  }
}

// Run the bot creation
createBot();
