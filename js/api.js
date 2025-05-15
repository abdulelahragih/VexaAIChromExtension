/**
 * Vexa API Utility Functions
 * This file contains utility functions for interacting with the Vexa API.
 */

class VexaAPI {
  constructor(apiKey = null) {
    this.BASE_URL = "https://gateway.dev.vexa.ai";
    this.apiKey = apiKey;
  }

  /**
   * Set the API key
   * @param {string} apiKey - The API key to use for requests
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Get the API key
   * @returns {string} The current API key
   */
  getApiKey() {
    return this.apiKey;
  }

  /**
   * Request a bot for a meeting
   * @param {string} meetingId - The ID of the Google Meet meeting
   * @param {string} language - The language for translation (default: 'en')
   * @param {string} botName - A custom name for the bot (default: 'VexaTranslator')
   * @returns {Promise} A promise that resolves to the response data or rejects with an error
   */
  async requestBot(meetingId, language = "en", botName = "VexaTranslator") {
    if (!this.apiKey) throw new Error("API key not set");

    try {
      const response = await fetch(`${this.BASE_URL}/bots`, {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "google_meet",
          native_meeting_id: meetingId,
          language: language,
          bot_name: botName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to request bot");
      }

      return await response.json();
    } catch (error) {
      console.error("Error requesting bot:", error);
      throw error;
    }
  }

  /**
   * Get the transcript for a meeting
   * @param {string} meetingId - The ID of the Google Meet meeting
   * @returns {Promise} A promise that resolves to the transcript data or rejects with an error
   */
  async getTranscript(meetingId) {
    if (!this.apiKey) throw new Error("API key not set");

    try {
      const response = await fetch(
        `${this.BASE_URL}/transcripts/google_meet/${meetingId}`,
        {
          method: "GET",
          headers: {
            "X-API-Key": this.apiKey,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get transcript");
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting transcript:", error);
      throw error;
    }
  }

  /**
   * Get the status of running bots
   * @returns {Promise} A promise that resolves to the bot status data or rejects with an error
   */
  async getBotStatus() {
    if (!this.apiKey) throw new Error("API key not set");

    try {
      const response = await fetch(`${this.BASE_URL}/bots/status`, {
        method: "GET",
        headers: {
          "X-API-Key": this.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to get bot status");
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting bot status:", error);
      throw error;
    }
  }

  /**
   * Update the configuration of a bot
   * @param {string} meetingId - The ID of the Google Meet meeting
   * @param {Object} config - The configuration to update (e.g., { language: 'es' })
   * @returns {Promise} A promise that resolves to the response data or rejects with an error
   */
  async updateBotConfig(meetingId, config) {
    if (!this.apiKey) throw new Error("API key not set");

    try {
      const response = await fetch(
        `${this.BASE_URL}/bots/google_meet/${meetingId}/config`,
        {
          method: "PUT",
          headers: {
            "X-API-Key": this.apiKey,
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
    } catch (error) {
      console.error("Error updating bot config:", error);
      throw error;
    }
  }

  /**
   * Stop a bot in a meeting
   * @param {string} meetingId - The ID of the Google Meet meeting
   * @returns {Promise} A promise that resolves to the response data or rejects with an error
   */
  async stopBot(meetingId) {
    if (!this.apiKey) throw new Error("API key not set");

    try {
      const response = await fetch(
        `${this.BASE_URL}/bots/google_meet/${meetingId}`,
        {
          method: "DELETE",
          headers: {
            "X-API-Key": this.apiKey,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to stop bot");
      }

      return await response.json();
    } catch (error) {
      console.error("Error stopping bot:", error);
      throw error;
    }
  }

  /**
   * List meetings
   * @returns {Promise} A promise that resolves to the meeting list data or rejects with an error
   */
  async listMeetings() {
    if (!this.apiKey) throw new Error("API key not set");

    try {
      const response = await fetch(`${this.BASE_URL}/meetings`, {
        method: "GET",
        headers: {
          "X-API-Key": this.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to list meetings");
      }

      return await response.json();
    } catch (error) {
      console.error("Error listing meetings:", error);
      throw error;
    }
  }
}

// Export the VexaAPI class
window.VexaAPI = VexaAPI;
