// Utility script to directly check for active bots
// Run this with "node check-bots.js" in your terminal

const fetch = require("node-fetch");

// Use the API key from your background.js
const API_KEY = ""; // Replace with your actual API key if needed
const BASE_URL = "https://gateway.dev.vexa.ai";

async function checkActiveBots() {
  console.log("Checking for active bots...");

  try {
    const response = await fetch(`${BASE_URL}/bots/status`, {
      method: "GET",
      headers: {
        "X-API-Key": API_KEY,
      },
    });

    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);
    console.log(`Response body: ${responseText}`);

    if (!response.ok) {
      console.error(`Error: ${response.status} - ${responseText}`);
      return;
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
      return;
    }

    // Check if there are running bots in the response
    if (
      data &&
      data.running_bots &&
      Array.isArray(data.running_bots) &&
      data.running_bots.length > 0
    ) {
      console.log(`\nFound ${data.running_bots.length} active bot(s):`);

      data.running_bots.forEach((bot, index) => {
        console.log(`\nBot #${index + 1}:`);
        console.log(`Platform: ${bot.platform || "unknown"}`);
        console.log(`Meeting ID: ${bot.native_meeting_id || "unknown"}`);
        console.log(`Status: ${bot.status || "unknown"}`);
        console.log(`Created at: ${bot.created_at || "unknown"}`);
        console.log(`Container ID: ${bot.container_id || "unknown"}`);
        console.log(`Container Name: ${bot.container_name || "unknown"}`);

        // Generate a command to stop this bot
        const stopCmd = `curl -X DELETE "${BASE_URL}/bots/${bot.platform}/${bot.native_meeting_id}" -H "X-API-Key: ${API_KEY}"`;
        console.log(`\nTo stop this bot, run this command:`);
        console.log(stopCmd);
      });
    } else if (Array.isArray(data) && data.length > 0) {
      // Handle the case where the response is a direct array
      console.log(`\nFound ${data.length} active bot(s):`);
      data.forEach((bot, index) => {
        console.log(`\nBot #${index + 1}:`);
        console.log(`Platform: ${bot.platform || "unknown"}`);
        console.log(
          `Meeting ID: ${bot.native_meeting_id || bot.meeting_id || "unknown"}`
        );
        console.log(`Status: ${bot.status || "unknown"}`);
      });
    } else {
      console.log(
        "\nNo active bots found. This is strange because you're getting concurrent bot limit errors."
      );
      console.log(
        "The API response format might have changed. Check the raw response above."
      );
    }
  } catch (error) {
    console.error("Error checking bots:", error);
  }
}

// Run the check
checkActiveBots();
