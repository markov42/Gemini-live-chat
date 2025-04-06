import { GeminiAgent } from './main/agent.js';
import { getConfig, getWebsocketUrl, getDeepgramApiKey, MODEL_SAMPLE_RATE } from './config/config.js';

import { GoogleSearchTool } from './tools/google-search.js';
import { ToolManager } from './tools/tool-manager.js';
import { ChatManager } from './chat/chat-manager.js';

import { setupEventListeners } from './dom/events.js';

const url = getWebsocketUrl();
const config = getConfig();
const deepgramApiKey = getDeepgramApiKey();

const toolManager = new ToolManager();
toolManager.registerTool('googleSearch', new GoogleSearchTool());

const chatManager = new ChatManager();

const geminiAgent = new GeminiAgent({
    url,
    config,
    deepgramApiKey,
    modelSampleRate: MODEL_SAMPLE_RATE,
    transcribeModelsSpeech: true,
    transcribeUsersSpeech: true,
    toolManager
});

// Display which model is active upon connection
geminiAgent.on('connected', () => {
    // Show which model is currently active
    chatManager.addModelInfoMessage(config.model);
});

// For REST API, we might get a more specific model from the response
geminiAgent.on('model_info', (modelName) => {
    // Update model info if we get a more specific model name from the API response
    chatManager.addModelInfoMessage(modelName);
});

// Handle chat-related events
geminiAgent.on('transcription', (transcript) => {
    chatManager.updateStreamingMessage(transcript);
});

// Improved user transcription handling with debouncing
let userTranscriptions = [];
let userTranscriptionTimeout = null;

geminiAgent.on('user_transcription', (transcript) => {
    console.log("User speech transcription received:", transcript);
    
    // Only process non-empty transcriptions
    if (transcript && transcript.trim().length > 0) {
        // Add this transcription to our collection
        userTranscriptions.push(transcript);
        
        // Clear any existing timeout
        if (userTranscriptionTimeout) {
            clearTimeout(userTranscriptionTimeout);
        }
        
        // Set a new timeout to process the transcriptions after a delay
        // This helps collect multiple transcript segments into one cohesive message
        userTranscriptionTimeout = setTimeout(() => {
            try {
                // Join all collected transcriptions
                const fullTranscript = userTranscriptions.join(' ').trim();
                
                if (fullTranscript.length > 0) {
                    console.log("Processing complete user transcription:", fullTranscript);
                    
                    // Display transcribed speech in the UI
                    chatManager.addUserMessage("🎙️: " + fullTranscript);
                    
                    // Send transcribed text to the model
                    geminiAgent.sendText(fullTranscript);
                }
                
                // Reset the collection
                userTranscriptions = [];
            } catch (error) {
                console.error("Error processing user transcription:", error);
            }
        }, 1000); // 1 second delay to collect multiple transcript segments
    }
});

geminiAgent.on('text_sent', (text) => {
    chatManager.finalizeStreamingMessage();
    chatManager.addUserMessage(text);
});

geminiAgent.on('interrupted', () => {
    chatManager.finalizeStreamingMessage();
    // Remove the automatic audio message creation that's causing the bug
    // Only add audio messages when we're actually recording audio
});

geminiAgent.on('turn_complete', () => {
    chatManager.finalizeStreamingMessage();
});

geminiAgent.on('text', (text) => {
    console.log('text', text);
    chatManager.updateStreamingMessage(text);
});

geminiAgent.connect();

setupEventListeners(geminiAgent);