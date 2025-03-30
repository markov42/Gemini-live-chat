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
    if (!chatManager.lastUserMessageType) {
        chatManager.addUserAudioMessage();
    }
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

// Force consistent transparency on focus/blur with improved handling
window.addEventListener('blur', maintainTransparency);
window.addEventListener('focus', maintainTransparency);
window.addEventListener('visibilitychange', maintainTransparency);
document.addEventListener('visibilitychange', maintainTransparency);

// Initial call to set consistent transparency
document.addEventListener('DOMContentLoaded', () => {
    maintainTransparency();
    // Apply transparency again after a short delay to catch any transitions
    setTimeout(maintainTransparency, 100);
    setTimeout(maintainTransparency, 500);
});

// Special handler to force proper transparency across focus changes
function maintainTransparency() {
    // Add classes to force consistent styling
    document.documentElement.classList.add('consistent-transparency');
    
    // Force transparent background
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    
    // Apply extremely light gradient
    document.body.style.background = 'linear-gradient(135deg, rgba(103, 58, 183, 0.05), rgba(33, 150, 243, 0.02))';
    
    // Force specific opacity
    document.body.style.opacity = '0.95';
    document.documentElement.style.opacity = '0.95';
    
    // Remove any filters that might affect transparency
    document.body.style.filter = 'none';
    document.documentElement.style.filter = 'none';
    
    // Force consistent backdrop filters on key elements
    const transparentElements = [
        '.chat-history', '.camera-preview', '.screen-preview', 
        '.settings-dialog', '.source-selection-dialog', '.text-input', 
        '.send-btn', '.sidebar', '.disconnect-btn', '.connect-btn',
        '.settings-btn', '.camera-btn', '.screen-btn', '.mic-btn',
        '.app-container'
    ];
    
    transparentElements.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.backgroundColor = 'rgba(30, 30, 60, 0.1)';
            el.style.backdropFilter = 'blur(8px)';
            el.style.webkitBackdropFilter = 'blur(8px)';
        });
    });
    
    // Create the absolute positioned elements for persistent backdrop filter if they don't exist
    ensureBackdropElements('.chat-area');
    ensureBackdropElements('.sidebar');
}

// Helper function to create persistent backdrop filter elements
function ensureBackdropElements(selector) {
    document.querySelectorAll(selector).forEach(el => {
        if (!el.querySelector('.backdrop-persistent')) {
            const backdropEl = document.createElement('div');
            backdropEl.className = 'backdrop-persistent';
            backdropEl.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                pointer-events: none;
                z-index: -1;
            `;
            el.prepend(backdropEl);
        }
    });
}