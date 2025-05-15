// Utility script to manage Vexa bots
// Run with:
// - node manage-bots.js list (to list active bots)
// - node manage-bots.js stop-all (to stop all active bots)
// - node manage-bots.js check-meetings (to check meeting history)

const fetch = require("node-fetch");
const readline = require("readline");

// Use the API key from your background.js
const API_KEY = ""; // Replace with your actual API key if needed
const BASE_URL = "https://gateway.dev.vexa.ai";

// Create readline interface for user interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper for prompting yes/no questions
const askYesNo = (question) => {
  return new Promise((resolve) => {
    rl.question(`${question} (y/n) `, (answer) => {
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
};

// Helper for API requests
async function makeRequest(url, method = "GET", body = null) {
  const headers = {
    "X-API-Key": API_KEY,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const responseText = await response.text();

  console.log(`${method} ${url} - Status: ${response.status}`);

  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (e) {
    console.error("Failed to parse response as JSON:", e);
    console.log("Raw response:", responseText);
    return null;
  }

  if (!response.ok) {
    console.error(
      `Error: ${response.status} - ${JSON.stringify(data, null, 2)}`
    );
    return null;
  }

  return data;
}

// List active bots
async function listActiveBots() {
  console.log("\n===== CHECKING ACTIVE BOTS =====");

  const data = await makeRequest(`${BASE_URL}/bots/status`);

  if (!data) {
    console.log("Failed to get bot status.");
    return [];
  }

  // Check if the response has a running_bots field (new API format)
  if (data.running_bots && Array.isArray(data.running_bots)) {
    if (data.running_bots.length > 0) {
      console.log(`\nFound ${data.running_bots.length} active bot(s):`);
      data.running_bots.forEach((bot, index) => {
        console.log(`\nBot #${index + 1}:`);
        console.log(`Platform: ${bot.platform || "unknown"}`);
        console.log(`Meeting ID: ${bot.native_meeting_id || "unknown"}`);
        console.log(`Status: ${bot.status || "unknown"}`);
        console.log(`Created at: ${bot.created_at || "unknown"}`);
      });
      return data.running_bots;
    } else {
      console.log("\nNo active bots found.");
      return [];
    }
  }
  // Handle the old API format (direct array)
  else if (Array.isArray(data) && data.length > 0) {
    console.log(`\nFound ${data.length} active bot(s):`);
    data.forEach((bot, index) => {
      console.log(`\nBot #${index + 1}:`);
      console.log(`Platform: ${bot.platform || "unknown"}`);
      console.log(
        `Meeting ID: ${bot.native_meeting_id || bot.meeting_id || "unknown"}`
      );
      console.log(`Status: ${bot.status || "unknown"}`);
    });
    return data;
  } else {
    console.log("\nNo active bots found through /bots/status endpoint.");
    return [];
  }
}

// List meetings
async function listMeetings() {
  console.log("\n===== CHECKING MEETING HISTORY =====");

  const data = await makeRequest(`${BASE_URL}/meetings`);

  if (!data) {
    console.log("Failed to get meetings.");
    return [];
  }

  if (Array.isArray(data) && data.length > 0) {
    console.log(`\nFound ${data.length} meeting(s) in history:`);

    // Look for active or recent meetings that might have bots
    const possibleActiveMeetings = data.filter(
      (meeting) =>
        meeting.status === "active" ||
        meeting.status === "in_progress" ||
        !meeting.end_time
    );

    if (possibleActiveMeetings.length > 0) {
      console.log(
        `\nFound ${possibleActiveMeetings.length} possibly active meeting(s):`
      );
      possibleActiveMeetings.forEach((meeting, index) => {
        console.log(`\nMeeting #${index + 1}:`);
        console.log(`Platform: ${meeting.platform || "unknown"}`);
        console.log(
          `Meeting ID: ${
            meeting.native_meeting_id || meeting.meeting_id || "unknown"
          }`
        );
        console.log(`Status: ${meeting.status || "unknown"}`);
        console.log(`Start time: ${meeting.start_time || "unknown"}`);
        console.log(`End time: ${meeting.end_time || "not ended"}`);
      });
      return possibleActiveMeetings;
    } else {
      console.log("\nNo active meetings found.");
      return [];
    }
  } else {
    console.log("\nNo meetings found.");
    return [];
  }
}

// Stop a specific bot
async function stopBot(meetingId, platform = "google_meet") {
  console.log(`\nAttempting to stop bot for meeting: ${meetingId}`);

  const data = await makeRequest(
    `${BASE_URL}/bots/${platform}/${meetingId}`,
    "DELETE"
  );

  if (data) {
    console.log(`Successfully requested to stop bot for meeting: ${meetingId}`);

    // Wait a few seconds for the bot to actually stop
    console.log("Waiting 5 seconds for the bot to terminate...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify that the bot has been stopped
    const statusCheck = await makeRequest(`${BASE_URL}/bots/status`);

    if (statusCheck && statusCheck.running_bots) {
      // Check if there's still a bot with this meeting ID
      const botStillRunning = statusCheck.running_bots.some(
        (bot) =>
          bot.native_meeting_id === meetingId || bot.meeting_id === meetingId
      );

      if (botStillRunning) {
        console.log(
          `WARNING: Bot for meeting ${meetingId} is still running after stop request.`
        );
        console.log("It may take a bit longer to fully terminate.");
        return false;
      } else {
        console.log(
          `Confirmed: Bot for meeting ${meetingId} has been successfully stopped.`
        );
        return true;
      }
    } else {
      // If we can't verify, assume success based on the initial response
      return true;
    }
  } else {
    console.log(`Failed to stop bot for meeting: ${meetingId}`);
    return false;
  }
}

// Stop all bots
async function stopAllBots() {
  console.log("\n===== STOPPING ALL BOTS =====");

  // First try the direct bot status approach
  const activeBots = await listActiveBots();

  if (activeBots.length > 0) {
    console.log(
      `\nAttempting to stop ${activeBots.length} bot(s) found via /bots/status...`
    );

    let successCount = 0;
    let failCount = 0;

    for (const bot of activeBots) {
      const meetingId = bot.native_meeting_id || bot.meeting_id;
      const platform = bot.platform || "google_meet";

      if (meetingId) {
        const success = await stopBot(meetingId, platform);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        console.log("Skipping bot with no meeting ID");
        failCount++;
      }
    }

    console.log(
      `\nStopped ${successCount} bot(s), failed to stop ${failCount} bot(s).`
    );
  }

  // Then try the meetings approach for any orphaned bots
  const activeMeetings = await listMeetings();

  if (activeMeetings.length > 0) {
    console.log(
      `\nFound ${activeMeetings.length} active meeting(s) that might have orphaned bots.`
    );

    const shouldStop = await askYesNo(
      "Do you want to try stopping bots for these meetings?"
    );

    if (shouldStop) {
      let successCount = 0;
      let failCount = 0;

      for (const meeting of activeMeetings) {
        const meetingId = meeting.native_meeting_id || meeting.meeting_id;
        const platform = meeting.platform || "google_meet";

        if (meetingId) {
          const success = await stopBot(meetingId, platform);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } else {
          console.log("Skipping meeting with no ID");
          failCount++;
        }
      }

      console.log(
        `\nStopped ${successCount} bot(s) from active meetings, failed to stop ${failCount}.`
      );
    }
  }

  console.log("\nAll operations completed. Checking for remaining bots...");
  const remainingBots = await listActiveBots();
  if (remainingBots.length === 0) {
    console.log("\nSuccess! No active bots remaining.");
  } else {
    console.log(`\nWarning: ${remainingBots.length} bot(s) still active.`);
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "list";

  try {
    switch (command) {
      case "list":
        await listActiveBots();
        break;
      case "stop-all":
        await stopAllBots();
        break;
      case "check-meetings":
        await listMeetings();
        break;
      case "help":
      default:
        console.log("\nUsage:");
        console.log("node manage-bots.js list - List active bots");
        console.log("node manage-bots.js stop-all - Stop all active bots");
        console.log(
          "node manage-bots.js check-meetings - Check meeting history"
        );
        break;
    }
  } catch (error) {
    console.error("Error executing command:", error);
  } finally {
    rl.close();
  }
}

// Run the main function
main();
