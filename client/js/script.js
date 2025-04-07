import { GeminiAgent } from './main/agent.js';
import { getConfig, getWebsocketUrl, getDeepgramApiKey, MODEL_SAMPLE_RATE } from './config/config.js';

import { GoogleSearchTool } from './tools/google-search.js';
import { ToolManager } from './tools/tool-manager.js';
import { ChatManager } from './chat/chat-manager.js';

import { setupEventListeners } from './dom/events.js';

const TRANSCRIPTION_DEBOUNCE_MS = 1000;

function initializeApplication() {
    const url = getWebsocketUrl();
    const config = getConfig();
    const deepgramApiKey = getDeepgramApiKey();

    const toolManager = new ToolManager();
    toolManager.registerTool('googleSearch', new GoogleSearchTool());

    const chatManager = new ChatManager();

    const geminiAgent = createAndConfigureAgent(url, config, deepgramApiKey, toolManager);
    setupEventHandlers(geminiAgent, chatManager);
    
    geminiAgent.connect();
    setupEventListeners(geminiAgent);
}

function createAndConfigureAgent(url, config, deepgramApiKey, toolManager) {
    return new GeminiAgent({
        url,
        config,
        deepgramApiKey,
        modelSampleRate: MODEL_SAMPLE_RATE,
        transcribeModelsSpeech: false,
        transcribeUsersSpeech: true,
        toolManager
    });
}

function setupEventHandlers(agent, chatManager) {
    let userTranscriptions = [];
    let userTranscriptionTimeout = null;

    agent.on('transcription', (transcript) => {
        chatManager.updateStreamingMessage(transcript);
    });

    agent.on('user_transcription', (transcript) => {
        if (!transcript || transcript.trim().length === 0) return;
        
        userTranscriptions.push(transcript);
        
        if (userTranscriptionTimeout) {
            clearTimeout(userTranscriptionTimeout);
        }
        
        userTranscriptionTimeout = setTimeout(() => {
            processUserTranscriptions(userTranscriptions, chatManager, agent);
            userTranscriptions = [];
        }, TRANSCRIPTION_DEBOUNCE_MS);
    });

    agent.on('text_sent', (text) => {
        chatManager.finalizeStreamingMessage();
        chatManager.addUserMessage(text);
    });

    agent.on('interrupted', () => {
        chatManager.finalizeStreamingMessage();
    });

    agent.on('turn_complete', () => {
        chatManager.finalizeStreamingMessage();
    });

    agent.on('text', (text) => {
        chatManager.updateStreamingMessage(text);
    });
}

function processUserTranscriptions(transcriptions, chatManager, agent) {
    try {
        const fullTranscript = transcriptions.join(' ').trim();
        
        if (fullTranscript.length > 0) {
            chatManager.addUserMessage("🎙️: " + fullTranscript);
            agent.sendText(fullTranscript);
        }
    } catch (error) {
        console.error("Error processing user transcription:", error);
    }
}

initializeApplication();