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

geminiAgent.on('transcription', (transcript) => {
    chatManager.updateStreamingMessage(transcript);
});

const TRANSCRIPTION_DEBOUNCE_MS = 1000;
let userTranscriptions = [];
let userTranscriptionTimeout = null;

geminiAgent.on('user_transcription', (transcript) => {
    console.log("User speech transcription received:", transcript);
    
    if (transcript && transcript.trim().length > 0) {
        userTranscriptions.push(transcript);
        
        if (userTranscriptionTimeout) {
            clearTimeout(userTranscriptionTimeout);
        }
        
        userTranscriptionTimeout = setTimeout(() => {
            try {
                const fullTranscript = userTranscriptions.join(' ').trim();
                
                if (fullTranscript.length > 0) {
                    console.log("Processing complete user transcription:", fullTranscript);
                    
                    chatManager.addUserMessage("🎙️: " + fullTranscript);
                    geminiAgent.sendText(fullTranscript);
                }
                
                userTranscriptions = [];
            } catch (error) {
                console.error("Error processing user transcription:", error);
            }
        }, TRANSCRIPTION_DEBOUNCE_MS);
    }
});

geminiAgent.on('text_sent', (text) => {
    chatManager.finalizeStreamingMessage();
    chatManager.addUserMessage(text);
});

geminiAgent.on('interrupted', () => {
    chatManager.finalizeStreamingMessage();
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