// Global variables
let meetingId = null;
let overlayContainer = null;
let translationLanguage = "en";
let isOverlayVisible = false;
let transcriptElements = {};
let pollingInterval = null;
let lastFetchTime = 0;
let isExtensionAlive = true;
let lastTranscriptData = null;
let lastSegmentCount = 0;
let lastFetchTimestamp = null;
let overlayOpacity = 0.9; // Default opacity value

// Helper function to check if extension is still alive
function checkRuntimeConnection() {
  try {
    // Try to send a simple message to the background script
    chrome.runtime.sendMessage({ action: "ping" }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("Extension context invalidated, stopping polling");
        isExtensionAlive = false;
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
        return false;
      }
      return true;
    });
  } catch (e) {
    console.log("Extension context error:", e);
    isExtensionAlive = false;
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    return false;
  }
}

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "meetDetected":
      // Meeting detected, store the meeting ID
      const isNewMeeting = meetingId !== message.meetingId;
      meetingId = message.meetingId;

      // If this is a new meeting, clear any existing transcript data
      if (isNewMeeting) {
        lastTranscriptData = null;
        lastSegmentCount = 0;
        lastFetchTimestamp = null;
        transcriptElements = {};

        // If overlay is already visible, update it for the new meeting
        if (overlayContainer && isOverlayVisible) {
          const transcriptContainer = document.getElementById(
            "vexa-transcript-container"
          );
          if (transcriptContainer) {
            transcriptContainer.innerHTML = "";
          }

          // Show loading indicator again
          const loadingIndicator = document.getElementById(
            "vexa-loading-indicator"
          );
          if (loadingIndicator) {
            loadingIndicator.style.display = "block";
          }
        }
      }

      sendResponse({ success: true });
      break;

    case "injectOverlay":
      // Inject the translation overlay into the current page
      const isNewBot = meetingId !== message.meetingId;
      meetingId = message.meetingId;
      translationLanguage = message.language || translationLanguage;

      // Always clear transcript data when explicitly injecting a new overlay
      lastTranscriptData = null;
      lastSegmentCount = 0;
      lastFetchTimestamp = null;
      transcriptElements = {};

      injectOverlay();
      startTranscriptPolling();
      sendResponse({ success: true });
      break;

    case "ping":
      // Simple ping to check if content script is alive
      sendResponse({ success: true });
      break;
  }
});

// Extract the meeting ID from the URL
function extractMeetingIdFromUrl() {
  const meetRegex = /meet\.google\.com\/([a-z0-9-]+)/i;
  const match = window.location.href.match(meetRegex);
  return match ? match[1] : null;
}

// Initialize when the content script loads
function initialize() {
  meetingId = extractMeetingIdFromUrl();

  // Load the custom CSS file
  loadCustomCSS();

  // Set up event listener for tab visibility change
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

// Function to load the custom CSS file
function loadCustomCSS() {
  // Check if the stylesheet is already loaded
  if (!document.querySelector('link[href*="overlay.css"]')) {
    const customCSS = document.createElement("link");
    customCSS.rel = "stylesheet";
    customCSS.href = chrome.runtime.getURL("overlay.css");
    document.head.appendChild(customCSS);
  }
}

// Handle tab visibility changes
function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    console.log("Tab became visible, checking extension status");
    // Tab is now visible again, check if extension is alive
    if (meetingId && !isExtensionAlive && !pollingInterval) {
      console.log("Reinitializing after tab became visible");
      // Reset extension status
      isExtensionAlive = true;

      // Check if overlay should be shown
      if (overlayContainer && isOverlayVisible) {
        // Try to restart transcript polling
        startTranscriptPolling();
      }
    }
  }
}

// Create and inject the translation overlay
function injectOverlay() {
  // Clear any previous transcript data when injecting a new overlay
  lastTranscriptData = null;
  lastSegmentCount = 0;
  lastFetchTimestamp = null;
  transcriptElements = {};

  if (overlayContainer) {
    // If overlay exists but we're initializing with a new bot, clear the transcript
    const transcriptContainer = document.getElementById(
      "vexa-transcript-container"
    );
    if (transcriptContainer) {
      transcriptContainer.innerHTML = "";
    }

    // Show loading indicator again
    const loadingIndicator = document.getElementById("vexa-loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.style.display = "block";
    }

    // Update the language selector if needed
    const languageSelect = document.getElementById("vexa-language-select");
    if (languageSelect) {
      languageSelect.value = translationLanguage;
    }

    // Overlay already exists, just make it visible
    showOverlay();
    return;
  }

  // Create the overlay container
  overlayContainer = document.createElement("div");
  overlayContainer.id = "vexa-translation-overlay";
  overlayContainer.classList.add("vexa-overlay");
  overlayContainer.style.backgroundColor = `rgba(255, 255, 255, ${overlayOpacity})`;

  // Create the header
  const header = document.createElement("div");
  header.className = "vexa-overlay-header";

  const title = document.createElement("div");
  title.className = "vexa-overlay-title";
  title.innerHTML = '<i class="fas fa-language"></i> Vexa Live Translation';

  const controls = document.createElement("div");
  controls.className = "vexa-overlay-controls";

  const expandBtn = document.createElement("button");
  expandBtn.className = "vexa-overlay-btn";
  expandBtn.id = "vexa-expand-btn";
  expandBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
  expandBtn.title = "Expand overlay";
  expandBtn.addEventListener("click", toggleOverlayExpand);

  const minimizeBtn = document.createElement("button");
  minimizeBtn.className = "vexa-overlay-btn";
  minimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
  minimizeBtn.addEventListener("click", toggleOverlayMinimize);

  const closeBtn = document.createElement("button");
  closeBtn.className = "vexa-overlay-btn";
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  closeBtn.addEventListener("click", hideOverlay);

  controls.appendChild(expandBtn);
  controls.appendChild(minimizeBtn);
  controls.appendChild(closeBtn);

  header.appendChild(title);
  header.appendChild(controls);

  // Create the language selector
  const languageSelector = document.createElement("div");
  languageSelector.className = "vexa-language-selector";

  const languageLabel = document.createElement("span");
  languageLabel.textContent = "Translation Language:";

  const languageSelect = document.createElement("select");
  languageSelect.id = "vexa-language-select";
  languageSelect.innerHTML = `
    <option value="en" ${
      translationLanguage === "en" ? "selected" : ""
    }>English</option>
    <option value="es" ${
      translationLanguage === "es" ? "selected" : ""
    }>Spanish</option>
    <option value="fr" ${
      translationLanguage === "fr" ? "selected" : ""
    }>French</option>
    <option value="de" ${
      translationLanguage === "de" ? "selected" : ""
    }>German</option>
    <option value="it" ${
      translationLanguage === "it" ? "selected" : ""
    }>Italian</option>
    <option value="pt" ${
      translationLanguage === "pt" ? "selected" : ""
    }>Portuguese</option>
    <option value="ru" ${
      translationLanguage === "ru" ? "selected" : ""
    }>Russian</option>
    <option value="zh" ${
      translationLanguage === "zh" ? "selected" : ""
    }>Chinese</option>
    <option value="ja" ${
      translationLanguage === "ja" ? "selected" : ""
    }>Japanese</option>
    <option value="ko" ${
      translationLanguage === "ko" ? "selected" : ""
    }>Korean</option>
    <option value="ar" ${
      translationLanguage === "ar" ? "selected" : ""
    }>Arabic</option>
  `;

  languageSelect.addEventListener("change", function () {
    changeTranslationLanguage(this.value);
  });

  languageSelector.appendChild(languageLabel);
  languageSelector.appendChild(languageSelect);

  // Add transparency control
  const transparencyControl = document.createElement("div");
  transparencyControl.className = "vexa-transparency-control";
  transparencyControl.innerHTML = `
    <label for="vexa-opacity-control">Opacity:</label>
    <input type="range" id="vexa-opacity-control" min="0.1" max="1" step="0.1" value="${overlayOpacity}">
  `;

  // Create the transcript container
  const transcriptContainer = document.createElement("div");
  transcriptContainer.id = "vexa-transcript-container";
  transcriptContainer.className = "vexa-transcript-container";

  // Create loading indicator
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "vexa-loading-indicator";
  loadingDiv.className = "vexa-loading";
  loadingDiv.innerHTML = `
    <div class="vexa-spinner"></div>
    <div>Connecting to translation service...</div>
  `;

  // Assemble the overlay
  overlayContainer.appendChild(header);
  overlayContainer.appendChild(languageSelector);
  overlayContainer.appendChild(transcriptContainer);
  overlayContainer.appendChild(loadingDiv);
  overlayContainer.appendChild(transparencyControl);

  // Add to the document
  document.body.appendChild(overlayContainer);

  // Add Font Awesome if it's not already on the page
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const fontAwesome = document.createElement("link");
    fontAwesome.rel = "stylesheet";
    fontAwesome.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css";
    document.head.appendChild(fontAwesome);
  }

  // Make the overlay draggable by its header
  makeElementDraggable(overlayContainer, header);

  // Set up opacity control
  document
    .getElementById("vexa-opacity-control")
    .addEventListener("input", function (e) {
      updateOverlayOpacity(e.target.value);
    });

  // Show the overlay
  showOverlay();
}

// Make an element draggable
function makeElementDraggable(element, dragHandle) {
  if (!element || !dragHandle) return;

  let isDragging = false;
  let initialX, initialY;
  let offsetX = 0,
    offsetY = 0;
  let rafId = null;

  // Apply will-change to optimize for animations
  element.style.willChange = "transform";

  // Set initial position if not already positioned
  if (getComputedStyle(element).position === "static") {
    element.style.position = "fixed";
  }

  // Set initial position if not already set
  if (!element.style.top && !element.style.transform) {
    element.style.top = "70px";
    element.style.left = "20px";

    // Convert to transform for better performance
    const rect = element.getBoundingClientRect();
    element.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    element.style.top = "0";
    element.style.left = "0";
  }

  // Use mousedown/mousemove/mouseup for drag operations
  dragHandle.addEventListener("mousedown", startDrag);

  function startDrag(e) {
    // Prevent default to avoid text selection during drag
    e.preventDefault();

    // Get initial mouse position
    initialX = e.clientX;
    initialY = e.clientY;

    // Get current transform values or default to 0,0
    const style = window.getComputedStyle(element);
    const transform = style.transform || "translate3d(0,0,0)";

    if (transform !== "none") {
      const matrix = new DOMMatrixReadOnly(transform);
      offsetX = matrix.m41; // translateX value
      offsetY = matrix.m42; // translateY value
    }

    // Set dragging state
    isDragging = true;

    // Add document-level event listeners for move and up
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopDrag);

    // Change cursor to indicate dragging
    document.body.style.cursor = "grabbing";
    dragHandle.style.cursor = "grabbing";
  }

  function onMouseMove(e) {
    if (!isDragging) return;

    // Calculate how far the mouse has moved
    const dx = e.clientX - initialX;
    const dy = e.clientY - initialY;

    // Cancel any existing animation frame
    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    // Schedule update on next animation frame for smoother performance
    rafId = requestAnimationFrame(() => {
      updateElementPosition(offsetX + dx, offsetY + dy);
    });
  }

  function updateElementPosition(x, y) {
    // Apply the transform - much more efficient than changing top/left
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function stopDrag() {
    if (!isDragging) return;

    isDragging = false;

    // Cancel any pending animation frame
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // Remove document-level event listeners
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", stopDrag);

    // Reset cursor
    document.body.style.cursor = "";
    dragHandle.style.cursor = "move";

    // Keep element within viewport bounds
    const rect = element.getBoundingClientRect();
    let newX = offsetX;
    let newY = offsetY;

    // Calculate bounds adjustments if needed
    if (rect.left < 0) {
      newX -= rect.left;
    } else if (rect.right > window.innerWidth) {
      newX -= rect.right - window.innerWidth;
    }

    if (rect.top < 0) {
      newY -= rect.top;
    } else if (rect.bottom > window.innerHeight) {
      newY -= rect.bottom - window.innerHeight;
    }

    // Apply final position with boundary adjustments if needed
    if (newX !== offsetX || newY !== offsetY) {
      updateElementPosition(newX, newY);
    }
  }
}

// Toggle the overlay minimized state
function toggleOverlayMinimize() {
  if (!overlayContainer) return;

  overlayContainer.classList.toggle("minimized");

  // Hide transparency control when minimized
  const transparencyControl = document.querySelector(
    ".vexa-transparency-control"
  );
  if (transparencyControl) {
    transparencyControl.style.display = overlayContainer.classList.contains(
      "minimized"
    )
      ? "none"
      : "flex";
  }
}

// Show the overlay
function showOverlay() {
  if (overlayContainer) {
    overlayContainer.classList.remove("hidden");
    isOverlayVisible = true;
  }
}

// Hide the overlay
function hideOverlay() {
  if (overlayContainer) {
    overlayContainer.classList.add("hidden");
    isOverlayVisible = false;
  }
}

// Change the translation language
function changeTranslationLanguage(language) {
  if (language === translationLanguage || !isExtensionAlive) return;

  translationLanguage = language;

  // Update the language with the API
  try {
    chrome.runtime.sendMessage(
      {
        action: "updateBotConfig",
        meetingId: meetingId,
        config: { language: language },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError);
          isExtensionAlive = false;
          return;
        }

        if (response && !response.success) {
          console.error("Failed to update language:", response.error);
          // Display an error toast or notification
        } else {
          console.log(`Successfully updated language to ${language}`);

          // Reset transcript data to force refresh with new language
          lastTranscriptData = null;
          lastSegmentCount = 0;
        }
      }
    );
  } catch (e) {
    console.error("Error in changeTranslationLanguage:", e);
    isExtensionAlive = false;
  }

  // Clear the transcript container
  const transcriptContainer = document.getElementById(
    "vexa-transcript-container"
  );
  if (transcriptContainer) {
    transcriptContainer.innerHTML = "";
    transcriptElements = {};
  }

  // Show loading indicator
  const loadingIndicator = document.getElementById("vexa-loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "block";
  }
}

// Poll for transcript updates
function startTranscriptPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Reset extension status
  isExtensionAlive = true;

  // Immediately fetch the transcript
  fetchTranscript();

  // Then set up interval to fetch every 1 second
  pollingInterval = setInterval(() => {
    // First check if extension is still alive
    if (!isExtensionAlive) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      return;
    }

    // Throttle fetches to prevent excessive API calls
    const now = Date.now();
    if (now - lastFetchTime >= 1000) {
      // 1 second minimum between calls
      fetchTranscript();
    }
  }, 1000); // Poll every 1 second
}

// Fetch the transcript from the API
function fetchTranscript() {
  if (!meetingId || !isExtensionAlive) return;

  lastFetchTime = Date.now();

  try {
    chrome.runtime.sendMessage(
      {
        action: "getTranscript",
        meetingId: meetingId,
        since: lastFetchTimestamp,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError);
          isExtensionAlive = false;
          return;
        }

        if (response && response.success) {
          // Update the last fetch timestamp if we have a server timestamp
          if (
            response.data &&
            response.data.segments &&
            response.data.segments.length > 0
          ) {
            // Find the most recent timestamp in the response
            const latestSegment = [...response.data.segments].sort((a, b) => {
              if (a.absolute_start_time && b.absolute_start_time) {
                return (
                  new Date(b.absolute_start_time) -
                  new Date(a.absolute_start_time)
                );
              }
              return b.start - a.start;
            })[0];

            // Use the absolute timestamp if available, otherwise use a relative one
            if (latestSegment.absolute_start_time) {
              lastFetchTimestamp = new Date(
                latestSegment.absolute_start_time
              ).toISOString();
            } else if (latestSegment.created_at) {
              lastFetchTimestamp = new Date(
                latestSegment.created_at
              ).toISOString();
            }

            // If this is our first fetch or we have more segments than before, update the UI
            const newSegmentCount = response.data.segments.length;
            if (
              newSegmentCount > lastSegmentCount ||
              lastTranscriptData === null
            ) {
              // If we're using the 'since' parameter, we need to merge with previous data
              if (lastFetchTimestamp && lastTranscriptData) {
                // Create a merged segments array, removing duplicates
                const existingSegmentIds = new Set(
                  lastTranscriptData.segments.map(
                    (s) =>
                      s.id ||
                      `${s.start}-${s.end}-${s.text?.substring(0, 20)}`.replace(
                        /\s+/g,
                        "-"
                      )
                  )
                );

                const newSegments = response.data.segments.filter((segment) => {
                  const segmentId =
                    segment.id ||
                    `${segment.start}-${segment.end}-${segment.text?.substring(
                      0,
                      20
                    )}`.replace(/\s+/g, "-");
                  return !existingSegmentIds.has(segmentId);
                });

                // Create a merged data object
                const mergedData = {
                  ...response.data,
                  segments: [...lastTranscriptData.segments, ...newSegments],
                };

                lastTranscriptData = mergedData;
                lastSegmentCount = mergedData.segments.length;
                updateTranscriptDisplay(mergedData);
              } else {
                // First fetch or not using 'since' parameter
                lastTranscriptData = response.data;
                lastSegmentCount = newSegmentCount;
                updateTranscriptDisplay(response.data);
              }
            }
          } else if (response.data && !response.data.segments) {
            // Handle the case where the API returns an empty or different format
            console.log("API returned data but no segments:", response.data);
            if (!lastTranscriptData) {
              // If we don't have any previous data, use this as our baseline
              lastTranscriptData = response.data;
              updateTranscriptDisplay(response.data);
            }
          }
        } else if (response) {
          console.error("Failed to get transcript:", response.error);
        }
      }
    );
  } catch (e) {
    console.error("Error in fetchTranscript:", e);
    isExtensionAlive = false;
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }
}

// Update the transcript display with new data
function updateTranscriptDisplay(transcriptData) {
  if (
    !transcriptData ||
    !transcriptData.segments ||
    transcriptData.segments.length === 0
  ) {
    return;
  }

  const loadingIndicator = document.getElementById("vexa-loading-indicator");
  const transcriptContainer = document.getElementById(
    "vexa-transcript-container"
  );

  if (loadingIndicator) {
    loadingIndicator.style.display = "none";
  }

  if (!transcriptContainer) return;

  // Keep track if we added new content (for autoscroll)
  let addedNewContent = false;

  // Create a map of existing segments to avoid reprocessing them
  const processedSegmentIds = new Set(Object.keys(transcriptElements));

  // Sort segments by start time to ensure chronological order
  const sortedSegments = [...transcriptData.segments].sort((a, b) => {
    // First try to sort by absolute start time if available
    if (a.absolute_start_time && b.absolute_start_time) {
      return new Date(a.absolute_start_time) - new Date(b.absolute_start_time);
    }
    // Fall back to relative start time
    return a.start - b.start;
  });

  // Process and display each segment that hasn't been displayed yet
  sortedSegments.forEach((segment) => {
    // Generate a stable ID for this segment
    const segmentId =
      segment.id ||
      `${segment.start}-${segment.end}-${segment.text?.substring(
        0,
        20
      )}`.replace(/\s+/g, "-");

    // Skip if we've already displayed this segment
    if (processedSegmentIds.has(segmentId)) return;

    // For segments without an ID, check if we have a similar segment already
    // This helps prevent duplicates when segments are slightly modified
    if (!segment.id) {
      // Check for segments with same text and similar timestamps
      const similarSegmentExists = Object.values(transcriptElements).some(
        (el) => {
          const text = el.querySelector(".vexa-transcript-text")?.textContent;
          return text === segment.text;
        }
      );

      if (similarSegmentExists) return;
    }

    // Create a new transcript item
    const transcriptItem = document.createElement("div");
    transcriptItem.className = "vexa-transcript-item";
    transcriptItem.dataset.segmentId = segmentId;

    // Format the timestamp (convert seconds to readable time)
    const timestamp = formatTimestamp(segment.start_time || segment.start);

    // Determine speaker name (use a default if not provided)
    const speakerName = segment.speaker_name || segment.speaker || "Speaker";

    // Create the transcript header with speaker and time
    const transcriptHeader = document.createElement("div");
    transcriptHeader.className = "vexa-transcript-header";
    transcriptHeader.innerHTML = `
      <span class="vexa-transcript-speaker">${speakerName}</span>
      <span class="vexa-transcript-time">${timestamp}</span>
    `;

    // Create the transcript text
    const transcriptText = document.createElement("div");
    transcriptText.className = "vexa-transcript-text";
    transcriptText.textContent = segment.text || "";

    // Assemble the transcript item
    transcriptItem.appendChild(transcriptHeader);
    transcriptItem.appendChild(transcriptText);

    // Add to the container (oldest first for better scrolling)
    transcriptContainer.appendChild(transcriptItem);

    // Store reference to avoid duplication
    transcriptElements[segmentId] = transcriptItem;
    addedNewContent = true;

    // Limit the number of displayed segments (keep the 100 most recent)
    // This prevents the DOM from growing too large
    const maxSegments = 100;
    if (Object.keys(transcriptElements).length > maxSegments) {
      // Find the oldest segment and remove it
      const oldestSegmentId = Object.keys(transcriptElements)[0];
      const oldestSegment = transcriptElements[oldestSegmentId];
      if (oldestSegment && oldestSegment.parentNode) {
        oldestSegment.parentNode.removeChild(oldestSegment);
        delete transcriptElements[oldestSegmentId];
      }
    }
  });

  // Auto-scroll to the bottom if new content was added
  if (addedNewContent) {
    // Smooth scroll with a small delay to ensure content is rendered
    setTimeout(() => {
      transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
    }, 100);
  }
}

// Format timestamp from seconds to readable time
function formatTimestamp(seconds) {
  if (!seconds && seconds !== 0) return "";

  // Get current date for reference
  const currentDate = new Date();
  // Create a date object from the seconds
  const date = new Date(seconds * 1000);

  // Format the time as HH:MM:SS
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const secs = date.getSeconds().toString().padStart(2, "0");

  return `${hours}:${minutes}:${secs}`;
}

// Clean up when the page unloads
function cleanup() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  if (overlayContainer && overlayContainer.parentNode) {
    overlayContainer.parentNode.removeChild(overlayContainer);
  }
}

// Initialize on load
initialize();

// Cleanup on unload
window.addEventListener("beforeunload", cleanup);

// Function to toggle overlay expansion
function toggleOverlayExpand() {
  if (!overlayContainer) return;

  if (overlayContainer.classList.contains("expanded")) {
    overlayContainer.classList.remove("expanded");
    document.getElementById("vexa-expand-btn").innerHTML =
      '<i class="fas fa-expand-alt"></i>';
    document.getElementById("vexa-expand-btn").title = "Expand overlay";
  } else {
    overlayContainer.classList.add("expanded");
    document.getElementById("vexa-expand-btn").innerHTML =
      '<i class="fas fa-compress-alt"></i>';
    document.getElementById("vexa-expand-btn").title = "Compress overlay";

    // If minimized, un-minimize when expanding
    if (overlayContainer.classList.contains("minimized")) {
      toggleOverlayMinimize();
    }
  }
}

// Function to update overlay opacity
function updateOverlayOpacity(value) {
  overlayOpacity = value;

  if (overlayContainer) {
    overlayContainer.style.backgroundColor = `rgba(255, 255, 255, ${value})`;

    // Also update any other elements that need transparency
    const transcriptContainer = document.getElementById(
      "vexa-transcript-container"
    );
    if (transcriptContainer) {
      transcriptContainer.style.backgroundColor = `rgba(255, 255, 255, ${value})`;
    }

    const languageSelector = document.querySelector(".vexa-language-selector");
    if (languageSelector) {
      languageSelector.style.backgroundColor = `rgba(255, 255, 255, ${value})`;
    }

    const loadingIndicator = document.getElementById("vexa-loading-indicator");
    if (loadingIndicator) {
      loadingIndicator.style.backgroundColor = `rgba(255, 255, 255, ${value})`;
    }
  }
}
