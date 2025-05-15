// Constants
const BASE_URL = "https://gateway.dev.vexa.ai";
let API_KEY = "";

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["vexaApiKey"], (result) => {
    if (result.vexaApiKey) {
      API_KEY = result.vexaApiKey;
    }
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "setApiKey":
      API_KEY = message.apiKey;
      chrome.storage.local.set({ vexaApiKey: API_KEY });
      sendResponse({ success: true });
      break;

    case "getApiKey":
      sendResponse({ apiKey: API_KEY });
      break;

    case "ping":
      // Simple ping to check connection
      sendResponse({ success: true });
      break;

    case "requestBot":
      requestBot(message.meetingId, message.language, message.botName)
        .then((response) => sendResponse({ success: true, data: response }))
        .catch((error) => {
          // Special handling for the concurrent bot limit error
          if (error.limitExceeded) {
            console.warn(
              "Concurrent bot limit exceeded. Checking for existing bots..."
            );
            getBotStatus()
              .then((botStatus) => {
                if (botStatus && botStatus.length > 0) {
                  sendResponse({
                    success: false,
                    error:
                      "You've reached the limit of concurrent bots. Please stop an existing bot before creating a new one.",
                    details: error.details,
                    limitExceeded: true,
                    existingBots: botStatus,
                  });
                } else {
                  // We have a limit error but no visible bots, might be orphaned bots
                  sendResponse({
                    success: false,
                    error:
                      "You've reached the limit of concurrent bots, but no active bots are visible. This could be due to orphaned bots from previous sessions.",
                    details: error.details,
                    limitExceeded: true,
                    orphanedBots: true,
                  });
                }
              })
              .catch((statusError) => {
                sendResponse({
                  success: false,
                  error: error.message,
                  details: error.details,
                  limitExceeded: true,
                });
              });
            return true; // Keep the message channel open for the async response
          }

          // Normal error handling for other errors
          sendResponse({
            success: false,
            error: error.message,
            details: error.details || null,
          });
        });
      return true; // Required for async response

    case "getTranscript":
      getTranscript(message.meetingId, message.since)
        .then((response) => sendResponse({ success: true, data: response }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    case "getBotStatus":
      getBotStatus()
        .then((response) => sendResponse({ success: true, data: response }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    case "updateBotConfig":
      updateBotConfig(message.meetingId, message.config)
        .then((response) => sendResponse({ success: true, data: response }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    case "stopBot":
      stopBot(message.meetingId)
        .then((response) => sendResponse({ success: true, data: response }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;

    case "listMeetings":
      listMeetings()
        .then((response) => sendResponse({ success: true, data: response }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true;
  }
});

// API Functions
async function requestBot(
  meetingId,
  language = "en",
  botName = "VexaTranslator"
) {
  if (!API_KEY) throw new Error("API key not set");

  console.log("Requesting bot with:", {
    meetingId,
    language,
    botName,
    apiKeyLength: API_KEY.length,
  });

  try {
    const response = await fetch(`${BASE_URL}/bots`, {
      method: "POST",
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: "google_meet",
        native_meeting_id: meetingId,
        language: language,
        bot_name: botName,
      }),
    });

    const responseData = await response.text();
    console.log("Bot request response status:", response.status);
    console.log("Bot request response:", responseData);

    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
      throw {
        message: "Invalid response from server",
        details: responseData.substring(0, 200), // Include part of the response for debugging
      };
    }

    if (!response.ok) {
      throw {
        message:
          parsedData.message || parsedData.detail || "Failed to request bot",
        details: parsedData,
        limitExceeded:
          parsedData.detail &&
          parsedData.detail.includes("maximum concurrent bot limit"),
      };
    }

    return parsedData;
  } catch (error) {
    console.error("Error in requestBot:", error);
    if (
      error instanceof TypeError &&
      error.message.includes("Failed to fetch")
    ) {
      throw {
        message:
          "Network error connecting to Vexa API. Please check your internet connection.",
        details: error.message,
      };
    }
    throw error;
  }
}

async function getTranscript(meetingId, since = null) {
  if (!API_KEY) throw new Error("API key not set");

  let url = `${BASE_URL}/transcripts/google_meet/${meetingId}`;

  // If a since timestamp is provided, add it as a query parameter
  if (since) {
    url += `?since=${encodeURIComponent(since)}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get transcript");
  }

  return await response.json();
}

async function getBotStatus() {
  if (!API_KEY) throw new Error("API key not set");

  const response = await fetch(`${BASE_URL}/bots/status`, {
    method: "GET",
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get bot status");
  }

  const data = await response.json();

  // Check if the response has the running_bots field (new API format)
  if (data && data.running_bots) {
    return data.running_bots; // Return the array of running bots
  }

  // Handle case where the response is the array directly (old format)
  if (Array.isArray(data)) {
    return data;
  }

  // If neither format matches, return an empty array
  return [];
}

async function updateBotConfig(meetingId, config) {
  if (!API_KEY) throw new Error("API key not set");

  const response = await fetch(
    `${BASE_URL}/bots/google_meet/${meetingId}/config`,
    {
      method: "PUT",
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update bot config");
  }

  return await response.json();
}

async function stopBot(meetingId) {
  if (!API_KEY) throw new Error("API key not set");

  const response = await fetch(`${BASE_URL}/bots/google_meet/${meetingId}`, {
    method: "DELETE",
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to stop bot");
  }

  return await response.json();
}

async function listMeetings() {
  if (!API_KEY) throw new Error("API key not set");

  const response = await fetch(`${BASE_URL}/meetings`, {
    method: "GET",
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to list meetings");
  }

  return await response.json();
}

// Extract meeting ID from Google Meet URL
function extractMeetingId(url) {
  const meetRegex = /meet\.google\.com\/([a-z0-9-]+)/i;
  const match = url.match(meetRegex);
  return match ? match[1] : null;
}

// When a tab is updated, check if it's a Google Meet and update the extension icon
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("meet.google.com")
  ) {
    const meetingId = extractMeetingId(tab.url);
    if (meetingId) {
      chrome.tabs.sendMessage(tabId, {
        action: "meetDetected",
        meetingId: meetingId,
      });
    }
  }
});
