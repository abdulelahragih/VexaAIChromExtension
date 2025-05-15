// DOM elements
const connectTabBtn = document.getElementById("connectTabBtn");
const botsTabBtn = document.getElementById("botsTabBtn");
const settingsTabBtn = document.getElementById("settingsTabBtn");
const connectTab = document.getElementById("connectTab");
const botsTab = document.getElementById("botsTab");
const settingsTab = document.getElementById("settingsTab");

const meetingDetected = document.getElementById("meetingDetected");
const noMeetingDetected = document.getElementById("noMeetingDetected");
const currentMeetingId = document.getElementById("currentMeetingId");

const translationLanguage = document.getElementById("translationLanguage");
const botName = document.getElementById("botName");
const connectBtn = document.getElementById("connectBtn");
const connectErrorMsg = document.getElementById("connectErrorMsg");
const connectSuccessMsg = document.getElementById("connectSuccessMsg");

const botListLoading = document.getElementById("botListLoading");
const botList = document.getElementById("botList");
const noBots = document.getElementById("noBots");
const refreshBotsBtn = document.getElementById("refreshBotsBtn");

const apiKey = document.getElementById("apiKey");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsErrorMsg = document.getElementById("settingsErrorMsg");
const settingsSuccessMsg = document.getElementById("settingsSuccessMsg");

// Global variables
let currentMeetId = null;
let activeBots = [];

// Tab navigation
connectTabBtn.addEventListener("click", () => showTab("connect"));
botsTabBtn.addEventListener("click", () => showTab("bots"));
settingsTabBtn.addEventListener("click", () => showTab("settings"));

function showTab(tabName) {
  // Hide all tabs
  connectTab.classList.remove("visible");
  botsTab.classList.remove("visible");
  settingsTab.classList.remove("visible");

  // Remove active class from all tab buttons
  connectTabBtn.classList.remove("active");
  botsTabBtn.classList.remove("active");
  settingsTabBtn.classList.remove("active");

  // Show selected tab and activate button
  if (tabName === "connect") {
    connectTab.classList.add("visible");
    connectTabBtn.classList.add("active");
  } else if (tabName === "bots") {
    botsTab.classList.add("visible");
    botsTabBtn.classList.add("active");
    loadBotList();
  } else if (tabName === "settings") {
    settingsTab.classList.add("visible");
    settingsTabBtn.classList.add("active");
    loadSettings();
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkForMeeting();
  loadSettings();

  connectBtn.addEventListener("click", connectBot);
  refreshBotsBtn.addEventListener("click", loadBotList);
  saveSettingsBtn.addEventListener("click", saveSettings);
});

// Check if we are in a Google Meet
function checkForMeeting() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (
      currentTab &&
      currentTab.url &&
      currentTab.url.includes("meet.google.com")
    ) {
      const meetId = extractMeetingId(currentTab.url);
      if (meetId) {
        currentMeetId = meetId;
        showMeetingDetected(meetId);
      } else {
        showNoMeetingDetected();
      }
    } else {
      showNoMeetingDetected();
    }
  });
}

function extractMeetingId(url) {
  const meetRegex = /meet\.google\.com\/([a-z0-9-]+)/i;
  const match = url.match(meetRegex);
  return match ? match[1] : null;
}

function showMeetingDetected(meetId) {
  noMeetingDetected.style.display = "none";
  meetingDetected.style.display = "block";
  currentMeetingId.textContent = meetId;
  connectBtn.disabled = false;
}

function showNoMeetingDetected() {
  noMeetingDetected.style.display = "block";
  meetingDetected.style.display = "none";
  connectBtn.disabled = true;
}

// Connect bot to meeting
function connectBot() {
  if (!currentMeetId) {
    showError(connectErrorMsg, "No meeting detected");
    return;
  }

  // Verify API key is set
  chrome.runtime.sendMessage({ action: "getApiKey" }, (response) => {
    if (!response.apiKey) {
      showError(connectErrorMsg, "API key not set. Please go to Settings tab.");
      showTab("settings");
      return;
    }

    // First check if there are any active bots
    connectBtn.disabled = true;
    connectBtn.innerHTML =
      '<div class="spinner"></div> Checking for active bots...';

    chrome.runtime.sendMessage({ action: "getBotStatus" }, (statusResponse) => {
      if (statusResponse.success) {
        const existingBots = statusResponse.data || [];

        if (existingBots.length > 0) {
          connectBtn.disabled = false;
          connectBtn.innerHTML =
            '<i class="fas fa-plug"></i> Connect Translation Bot';

          showError(
            connectErrorMsg,
            `You already have ${existingBots.length} active bot(s). Please stop existing bots before creating a new one.`
          );
          showTab("bots"); // Switch to the bots tab to show the user their active bots
          return;
        }

        // No active bots found, proceed with bot creation
        const language = translationLanguage.value;
        const customBotName = botName.value.trim() || "VexaTranslator";

        connectBtn.innerHTML = '<div class="spinner"></div> Connecting...';
        console.log("Connecting bot with:", {
          meetingId: currentMeetId,
          language,
          botName: customBotName,
        });

        chrome.runtime.sendMessage(
          {
            action: "requestBot",
            meetingId: currentMeetId,
            language: language,
            botName: customBotName,
          },
          (response) => {
            connectBtn.disabled = false;
            connectBtn.innerHTML =
              '<i class="fas fa-plug"></i> Connect Translation Bot';

            if (response.success) {
              showSuccess(
                connectSuccessMsg,
                "Bot connected successfully! Opening translation view..."
              );

              // Send message to current tab to inject the translation overlay
              chrome.tabs.query(
                { active: true, currentWindow: true },
                (tabs) => {
                  if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: "injectOverlay",
                      meetingId: currentMeetId,
                      language: language,
                    });
                  }
                }
              );

              // Switch to bots tab after a delay
              setTimeout(() => {
                showTab("bots");
              }, 1500);
            } else {
              let errorMessage = response.error || "Failed to connect bot";

              // Log detailed error information
              console.error(
                "Bot connection error:",
                response.error,
                response.details
              );

              // Add more context if available
              if (response.details) {
                if (typeof response.details === "object") {
                  try {
                    const detailsStr = JSON.stringify(response.details);
                    console.log("Error details:", detailsStr);

                    // If there's a specific error code or additional information, show it
                    if (response.details.code) {
                      errorMessage += ` (Error code: ${response.details.code})`;
                    }

                    // Check for common error conditions
                    if (
                      detailsStr.includes("quota") ||
                      detailsStr.includes("limit")
                    ) {
                      errorMessage =
                        "You've reached the limit of concurrent bots. Please stop an existing bot before creating a new one.";
                      // Also check for ghost bots by loading meeting history
                      loadMeetingHistory();
                    } else if (
                      detailsStr.includes("invalid") &&
                      detailsStr.includes("key")
                    ) {
                      errorMessage =
                        "Invalid API key. Please check your API key in the Settings tab.";
                    } else if (detailsStr.includes("unauthorized")) {
                      errorMessage =
                        "Unauthorized. Please check your API key in the Settings tab.";
                    }
                  } catch (e) {
                    console.error("Error parsing error details:", e);
                  }
                } else {
                  console.log("Error details (string):", response.details);
                }
              }

              showError(connectErrorMsg, errorMessage);
            }
          }
        );
      } else {
        // Failed to check bot status
        connectBtn.disabled = false;
        connectBtn.innerHTML =
          '<i class="fas fa-plug"></i> Connect Translation Bot';
        showError(
          connectErrorMsg,
          "Could not check for existing bots: " +
            (statusResponse.error || "Unknown error")
        );
      }
    });
  });
}

// Load bot list
function loadBotList() {
  botListLoading.style.display = "block";
  botList.style.display = "none";
  noBots.style.display = "none";

  chrome.runtime.sendMessage({ action: "getBotStatus" }, (response) => {
    botListLoading.style.display = "none";

    if (response.success) {
      activeBots = response.data || [];

      if (activeBots.length > 0) {
        renderBotList(activeBots);
        botList.style.display = "block";
      } else {
        // No active bots found, try loading meeting history instead
        loadMeetingHistory();
        noBots.style.display = "block";
      }
    } else {
      noBots.style.display = "block";
      noBots.innerHTML = `<p>Error loading bots: ${
        response.error || "Unknown error"
      }</p>`;
    }
  });
}

function renderBotList(bots) {
  botList.innerHTML = "";

  bots.forEach((bot) => {
    const botItem = document.createElement("div");
    botItem.className = "bot-item";

    const meetingId = bot.meeting_id || bot.native_meeting_id || "Unknown";
    const platform = bot.platform || "google_meet";
    const status = bot.status || "unknown";
    const language = bot.language || "en";

    botItem.innerHTML = `
      <div>
        <span class="status-indicator ${
          status === "active" ? "status-active" : "status-inactive"
        }"></span>
        <strong>${platform}:</strong> ${meetingId}
      </div>
      <div>Language: ${language}</div>
      <div class="bot-controls">
        <button class="btn btn-primary view-bot" data-meeting-id="${meetingId}" data-platform="${platform}">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn btn-primary show-transcript" data-meeting-id="${meetingId}" data-platform="${platform}" data-language="${language}">
          <i class="fas fa-comment-alt"></i> Show Transcript
        </button>
        <button class="btn btn-danger stop-bot" data-meeting-id="${meetingId}" data-platform="${platform}">
          <i class="fas fa-stop"></i> Stop
        </button>
      </div>
    `;

    botList.appendChild(botItem);
  });

  // Add event listeners for bot actions
  document.querySelectorAll(".view-bot").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const meetingId = e.currentTarget.getAttribute("data-meeting-id");
      const platform = e.currentTarget.getAttribute("data-platform");
      const button = e.currentTarget;

      // Disable button while processing
      safeUpdateButton(button, true, '<div class="spinner"></div> Opening...');
      const originalText = button.innerHTML;

      // Check if the tab is already open
      chrome.tabs.query({}, (tabs) => {
        const meetUrl = `meet.google.com/${meetingId}`;
        const existingTab = tabs.find(
          (tab) => tab.url && tab.url.includes(meetUrl)
        );

        if (existingTab) {
          // If meeting tab exists, activate it
          chrome.tabs.update(existingTab.id, { active: true }, () => {
            setTimeout(() => {
              try {
                chrome.tabs.sendMessage(existingTab.id, {
                  action: "injectOverlay",
                  meetingId: meetingId,
                });
              } catch (e) {
                console.error("Error injecting overlay:", e);
              }
              // Re-enable button
              safeUpdateButton(button, false, originalText);
            }, 1000);
          });
        } else {
          // Open Google Meet in a new tab
          chrome.tabs.create(
            { url: `https://meet.google.com/${meetingId}` },
            (tab) => {
              // We'll send a message to this tab once it's loaded to inject the overlay
              setTimeout(() => {
                try {
                  chrome.tabs.sendMessage(tab.id, {
                    action: "injectOverlay",
                    meetingId: meetingId,
                  });
                } catch (e) {
                  console.error("Error injecting overlay in new tab:", e);
                }
                // Re-enable button
                safeUpdateButton(button, false, originalText);
              }, 3000); // Give the page some time to load
            }
          );
        }
      });
    });
  });

  // Add event listener for the Show Transcript button
  document.querySelectorAll(".show-transcript").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const meetingId = e.currentTarget.getAttribute("data-meeting-id");
      const platform = e.currentTarget.getAttribute("data-platform");
      const language = e.currentTarget.getAttribute("data-language");

      // Disable the button while processing
      e.currentTarget.disabled = true;
      const originalText = e.currentTarget.innerHTML;
      e.currentTarget.innerHTML = '<div class="spinner"></div> Opening...';

      // Check if we can ping the tab with this meeting ID first
      function checkTabExists(callback) {
        chrome.tabs.query({}, (tabs) => {
          const meetUrl = `meet.google.com/${meetingId}`;
          const existingTab = tabs.find(
            (tab) => tab.url && tab.url.includes(meetUrl)
          );

          callback(existingTab);
        });
      }

      // Function to handle opening the transcript
      function openTranscript(existingTab) {
        if (existingTab) {
          // If meeting tab exists, activate it and show the transcript
          chrome.tabs.update(existingTab.id, { active: true }, () => {
            // Try to ping the content script to see if it's still alive
            try {
              chrome.tabs.sendMessage(
                existingTab.id,
                { action: "ping" },
                (response) => {
                  if (chrome.runtime.lastError || !response) {
                    // Content script is not responsive, reload the tab
                    console.log("Content script not responding, reloading tab");
                    chrome.tabs.reload(existingTab.id, {}, () => {
                      // After reload, wait and then try to inject
                      setTimeout(() => {
                        chrome.tabs.sendMessage(existingTab.id, {
                          action: "injectOverlay",
                          meetingId: meetingId,
                          language: language,
                        });
                        // Re-enable button
                        e.currentTarget.disabled = false;
                        e.currentTarget.innerHTML = originalText;
                      }, 3000);
                    });
                  } else {
                    // Content script is alive, send message
                    chrome.tabs.sendMessage(existingTab.id, {
                      action: "injectOverlay",
                      meetingId: meetingId,
                      language: language,
                    });
                    // Re-enable button
                    e.currentTarget.disabled = false;
                    e.currentTarget.innerHTML = originalText;
                  }
                }
              );
            } catch (error) {
              console.error("Error communicating with tab:", error);
              // Still try to inject the overlay
              setTimeout(() => {
                try {
                  chrome.tabs.sendMessage(existingTab.id, {
                    action: "injectOverlay",
                    meetingId: meetingId,
                    language: language,
                  });
                } catch (e) {
                  console.error("Failed to inject overlay:", e);
                }
                // Re-enable button
                e.currentTarget.disabled = false;
                e.currentTarget.innerHTML = originalText;
              }, 1000);
            }
          });
        } else {
          // Open the meeting in a new tab
          chrome.tabs.create(
            { url: `https://meet.google.com/${meetingId}` },
            (tab) => {
              // We'll send a message to this tab once it's loaded to inject the overlay
              setTimeout(() => {
                try {
                  chrome.tabs.sendMessage(tab.id, {
                    action: "injectOverlay",
                    meetingId: meetingId,
                    language: language,
                  });
                } catch (e) {
                  console.error("Error injecting overlay in new tab:", e);
                }
                // Re-enable button
                e.currentTarget.disabled = false;
                e.currentTarget.innerHTML = originalText;
              }, 3000); // Give the page some time to load
            }
          );
        }
      }

      // Start by checking if tab exists
      checkTabExists(openTranscript);
    });
  });

  document.querySelectorAll(".stop-bot").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const meetingId = e.currentTarget.getAttribute("data-meeting-id");
      const platform = e.currentTarget.getAttribute("data-platform");

      if (
        confirm(
          `Are you sure you want to stop the bot for meeting ${meetingId}?`
        )
      ) {
        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = '<div class="spinner"></div> Stopping...';

        chrome.runtime.sendMessage(
          { action: "stopBot", meetingId: meetingId },
          (response) => {
            if (response.success) {
              loadBotList(); // Refresh the list
            } else {
              alert(`Error stopping bot: ${response.error || "Unknown error"}`);
              e.currentTarget.disabled = false;
              e.currentTarget.innerHTML = '<i class="fas fa-stop"></i> Stop';
            }
          }
        );
      }
    });
  });
}

// Add a new function to load meeting history
function loadMeetingHistory() {
  console.log("Checking meeting history for possible active bots...");

  // Update the noBots div to show we're checking meeting history
  noBots.innerHTML =
    '<p>You don\'t have any active bots.</p><div class="spinner"></div> Checking meeting history...';

  chrome.runtime.sendMessage({ action: "listMeetings" }, (response) => {
    if (response.success && response.data && response.data.length > 0) {
      console.log("Meeting history:", response.data);

      // Look for meetings that might have active bots
      const possibleActiveMeetings = response.data.filter(
        (meeting) =>
          meeting.status === "active" ||
          meeting.status === "in_progress" ||
          !meeting.end_time
      );

      if (possibleActiveMeetings.length > 0) {
        console.log("Possible active meetings:", possibleActiveMeetings);
        noBots.innerHTML = `
          <p>You don't have any visible active bots, but there might be active meetings in your account:</p>
          <div style="margin-top: 10px; padding: 10px; background-color: #fff3cd; border-radius: 4px; color: #856404;">
            <strong>Troubleshooting:</strong> The server indicates you've reached the maximum bot limit (1), 
            but no active bots are visible. You may have orphaned bots from previous sessions.
          </div>
          <div style="margin-top: 10px;">
            <button id="forceStopAllBtn" class="btn btn-danger">
              <i class="fas fa-stop-circle"></i> Force Stop All Bots
            </button>
          </div>
        `;

        // Add event listener for the force stop button
        document
          .getElementById("forceStopAllBtn")
          .addEventListener("click", forceStopAllBots);
      } else {
        noBots.innerHTML = `
          <p>You don't have any active bots.</p>
          <div style="margin-top: 10px; padding: 10px; background-color: #fff3cd; border-radius: 4px; color: #856404;">
            <strong>Note:</strong> The server indicates you've reached the maximum bot limit (1), 
            but no active bots or meetings were found. This is a server-side inconsistency.
          </div>
          <div style="margin-top: 10px;">
            <button id="showOrphanedBotHelpBtn" class="btn btn-warning">
              <i class="fas fa-question-circle"></i> Show Help for This Issue
            </button>
          </div>
        `;

        // Add event listener for the help button
        document
          .getElementById("showOrphanedBotHelpBtn")
          .addEventListener("click", handleOrphanedBotError);
      }
    } else {
      noBots.innerHTML = "<p>You don't have any active bots.</p>";
      if (!response.success) {
        console.error("Error loading meeting history:", response.error);
      }
    }
  });
}

// Add a new function to force stop all bots
function forceStopAllBots() {
  const button = document.getElementById("forceStopAllBtn");
  button.disabled = true;
  button.innerHTML = '<div class="spinner"></div> Stopping all bots...';

  // First try to get the list of active meetings
  chrome.runtime.sendMessage({ action: "listMeetings" }, (meetingsResponse) => {
    if (meetingsResponse.success && meetingsResponse.data) {
      const meetings = meetingsResponse.data;
      const activeMeetingIds = meetings
        .filter(
          (m) =>
            m.status === "active" || m.status === "in_progress" || !m.end_time
        )
        .map((m) => m.native_meeting_id || m.meeting_id)
        .filter((id) => id); // Filter out null/undefined IDs

      console.log("Attempting to stop bots for meetings:", activeMeetingIds);

      if (activeMeetingIds.length === 0) {
        button.innerHTML =
          '<i class="fas fa-check-circle"></i> No active meetings found';
        setTimeout(() => {
          loadBotList(); // Refresh the list
        }, 2000);
        return;
      }

      let stoppedCount = 0;
      let errorCount = 0;

      // Try to stop each potentially active bot
      activeMeetingIds.forEach((meetingId) => {
        chrome.runtime.sendMessage(
          { action: "stopBot", meetingId: meetingId },
          (stopResponse) => {
            console.log(`Stop bot response for ${meetingId}:`, stopResponse);
            if (stopResponse.success) {
              stoppedCount++;
            } else {
              errorCount++;
            }

            // Check if we've processed all meetings
            if (stoppedCount + errorCount === activeMeetingIds.length) {
              if (errorCount === 0) {
                button.innerHTML = `<i class="fas fa-check-circle"></i> Stopped ${stoppedCount} bot(s)`;
              } else {
                button.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Stopped ${stoppedCount}, failed ${errorCount}`;
              }

              setTimeout(() => {
                loadBotList(); // Refresh the list
              }, 2000);
            }
          }
        );
      });
    } else {
      button.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Failed to get meetings';
      button.disabled = false;
    }
  });
}

// Add a new function to handle the orphaned bot situation
function handleOrphanedBotError() {
  noBots.innerHTML = `
    <div style="padding: 16px; background-color: #fff3cd; border-radius: 4px; color: #856404; margin-bottom: 16px;">
      <h4 style="margin-top: 0;"><i class="fas fa-exclamation-triangle"></i> Bot Limit Issue Detected</h4>
      <p>The Vexa API reports that you've reached your maximum bot limit, but no active bots are visible.</p>
      <p>This is likely due to orphaned bot sessions that weren't properly terminated.</p>
      
      <h5 style="margin-bottom: 8px;">Solutions:</h5>
      <ol style="margin-left: 20px; padding-left: 0;">
        <li>Contact Vexa support to reset your bot count</li>
        <li>Wait 24-48 hours for orphaned sessions to automatically time out</li>
        <li>Try using a different API key if available</li>
      </ol>
    </div>
    <button id="refreshStatusBtn" class="btn btn-primary btn-block">
      <i class="fas fa-sync-alt"></i> Refresh Status
    </button>
  `;

  // Add event listener for the refresh button
  document
    .getElementById("refreshStatusBtn")
    .addEventListener("click", loadBotList);
}

// Settings
function loadSettings() {
  chrome.runtime.sendMessage({ action: "getApiKey" }, (response) => {
    if (response.apiKey) {
      apiKey.value = response.apiKey;
    }
  });
}

function saveSettings() {
  const key = apiKey.value.trim();

  if (!key) {
    showError(settingsErrorMsg, "Please enter a valid API key");
    return;
  }

  // Basic API key format validation
  if (key.length < 20) {
    showError(
      settingsErrorMsg,
      "The API key appears to be too short. Please check your key."
    );
    return;
  }

  // Remove any accidental whitespace or quotes that might have been copied
  const cleanKey = key.replace(/["'\s]/g, "");
  if (cleanKey !== key) {
    apiKey.value = cleanKey;
    showError(
      settingsErrorMsg,
      "Whitespace or quotes were removed from your API key."
    );
    return;
  }

  saveSettingsBtn.disabled = true;
  saveSettingsBtn.innerHTML = '<div class="spinner"></div> Saving...';

  chrome.runtime.sendMessage(
    { action: "setApiKey", apiKey: key },
    (response) => {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.innerHTML = '<i class="fas fa-save"></i> Save Settings';

      if (response.success) {
        showSuccess(settingsSuccessMsg, "Settings saved successfully");

        // Test the API key right away to verify it works
        setTimeout(() => {
          testApiKey(key);
        }, 500);
      } else {
        showError(settingsErrorMsg, "Failed to save settings");
      }
    }
  );
}

// Test if the API key is valid by making a simple request
function testApiKey(key) {
  chrome.runtime.sendMessage({ action: "getBotStatus" }, (response) => {
    if (!response.success) {
      if (
        response.error &&
        (response.error.includes("invalid") ||
          response.error.includes("unauthorized") ||
          response.error.includes("API key"))
      ) {
        showError(
          settingsErrorMsg,
          "The API key appears to be invalid. Please check your key."
        );
      }
    }
  });
}

// Utility functions
function showError(element, message) {
  element.textContent = message;
  element.style.display = "block";

  setTimeout(() => {
    element.style.display = "none";
  }, 5000);
}

function showSuccess(element, message) {
  element.textContent = message;
  element.style.display = "block";

  setTimeout(() => {
    element.style.display = "none";
  }, 5000);
}

// Safely update button state to prevent errors when popup is closed
function safeUpdateButton(button, disabled, html) {
  // Check if the button still exists in the DOM
  if (button && document.body.contains(button)) {
    button.disabled = disabled;
    if (html !== undefined) {
      button.innerHTML = html;
    }
    return true;
  }
  return false;
}
