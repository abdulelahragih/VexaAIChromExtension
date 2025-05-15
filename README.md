# Vexa Live Translation for Google Meet

This Chrome extension integrates with the Vexa API to provide real-time translation of Google Meet conversations.

## Features

- **Automatic Meeting Detection**: Automatically detects when you're in a Google Meet.
- **Real-time Translation**: Translates conversations in real-time using Vexa's API.
- **Multiple Languages**: Support for multiple translation languages.
- **Transparent Overlay**: A draggable, transparent overlay that displays translations without blocking the video.
- **Bot Management**: Start, stop, and view your active translation bots.

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and visible in your extensions list

## Setup

1. Click on the extension icon in your Chrome toolbar
2. Go to the "Settings" tab
3. Enter your Vexa API key (You can get one from the Vexa website https://vexa.ai/)
4. Save the settings

## Usage

1. Join a Google Meet call
2. Click on the extension icon in your Chrome toolbar
3. Select your desired translation language
4. Click "Connect Translation Bot"
5. The bot will join the meeting and start translating
6. A draggable overlay will appear showing real-time translations

## Managing Bots

1. Click on the extension icon in your Chrome toolbar
2. Go to the "My Bots" tab to see all your active bots
3. From here, you can:
   - View a bot's translations
   - Stop a bot

## Changing Translation Language

1. Click on the language dropdown in the translation overlay
2. Select a new language
3. The translations will update to the new language

## Notes

- You need a valid Vexa API key to use this extension
- The Vexa API is currently in beta, and limits may apply
- Currently supports one concurrent bot per API key (default limit)

## Troubleshooting

- If translations aren't appearing, make sure your API key is correct
- If the bot doesn't join, try refreshing the page and reconnecting
- For other issues, check the console logs for error messages

## Technologies Used

- JavaScript
- Chrome Extension APIs
- Vexa API for real-time transcription and translation


## Support

For issues with the extension, please open an issue in this repository.
For issues with the Vexa API, please contact the Vexa team on their Discord channel.
