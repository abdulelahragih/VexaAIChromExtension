// Script to stop a specific bot
const fetch = require("node-fetch");

// Use the API key from your background.js
const API_KEY = "";
const BASE_URL = "https://gateway.dev.vexa.ai";

// The meeting ID from the running bot we found
const MEETING_ID = "kdq-rxyg-zxd";
const PLATFORM = "google_meet";

async function stopBot() {
  console.log(`Attempting to stop bot for meeting: ${MEETING_ID}`);

  try {
    const response = await fetch(`${BASE_URL}/bots/${PLATFORM}/${MEETING_ID}`, {
      method: "DELETE",
      headers: {
        "X-API-Key": API_KEY,
      },
    });

    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);
    console.log(`Response body: ${responseText}`);

    if (!response.ok) {
      console.error(`Error stopping bot: ${response.status} - ${responseText}`);
      return;
    }

    console.log(`\nSuccessfully stopped bot for meeting: ${MEETING_ID}`);

    // Now check if there are any remaining bots
    await checkRemainingBots();
  } catch (error) {
    console.error("Error stopping bot:", error);
  }
}

async function checkRemainingBots() {
  console.log("\nChecking for any remaining active bots...");

  try {
    const response = await fetch(`${BASE_URL}/bots/status`, {
      method: "GET",
      headers: {
        "X-API-Key": API_KEY,
      },
    });

    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      console.error(
        `Error checking bots: ${response.status} - ${responseText}`
      );
      return;
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
      return;
    }

    // Check if there are still running bots
    if (
      data &&
      data.running_bots &&
      Array.isArray(data.running_bots) &&
      data.running_bots.length > 0
    ) {
      console.log(
        `\nWARNING: Still found ${data.running_bots.length} active bot(s):`
      );

      data.running_bots.forEach((bot, index) => {
        console.log(`\nBot #${index + 1}:`);
        console.log(`Platform: ${bot.platform || "unknown"}`);
        console.log(`Meeting ID: ${bot.native_meeting_id || "unknown"}`);
      });
    } else {
      console.log("\nSUCCESS: No active bots remaining!");
      console.log("You should now be able to create a new bot.");
    }
  } catch (error) {
    console.error("Error checking bots:", error);
  }
}

// Run the stop bot function
stopBot();
