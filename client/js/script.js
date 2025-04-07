import { GeminiAgent } from './main/agent.js';
import { getConfig, getModelType, getGeminiApiKey, getOpenAIApiKey, getDeepgramApiKey, MODEL_SAMPLE_RATE } from './config/config.js';

import { GoogleSearchTool } from './tools/google-search.js';
import { ToolManager } from './tools/tool-manager.js';
import { ChatManager } from './chat/chat-manager.js';

import { setupEventListeners } from './dom/events.js';

const TRANSCRIPTION_DEBOUNCE_MS = 1000;

function initializeApplication() {
    const config = getConfig();
    const modelType = getModelType();
    const geminiApiKey = getGeminiApiKey();
    const openaiApiKey = getOpenAIApiKey();
    const deepgramApiKey = getDeepgramApiKey();

    // Show which model is active
    displayActiveModel(modelType);

    const toolManager = new ToolManager();
    toolManager.registerTool('googleSearch', new GoogleSearchTool());

    const chatManager = new ChatManager();

    const agent = createAndConfigureAgent(config, modelType, geminiApiKey, openaiApiKey, deepgramApiKey, toolManager);
    setupEventHandlers(agent, chatManager, modelType);
    
    agent.connect().then(() => {
        if (agent.initialize) {
            return agent.initialize();
        }
    }).catch(error => {
        console.error("Error initializing agent:", error);
        chatManager.addSystemMessage("Error initializing chat agent. Please check your API keys and settings.");
    });
    
    setupEventListeners(agent);
}

function displayActiveModel(modelType) {
    // Create model indicator element if it doesn't exist
    let modelIndicator = document.getElementById('modelIndicator');
    if (!modelIndicator) {
        modelIndicator = document.createElement('div');
        modelIndicator.id = 'modelIndicator';
        modelIndicator.style.position = 'absolute';
        modelIndicator.style.top = '10px';
        modelIndicator.style.right = '10px';
        modelIndicator.style.padding = '5px 10px';
        modelIndicator.style.borderRadius = '5px';
        modelIndicator.style.fontSize = '12px';
        modelIndicator.style.fontWeight = 'bold';
        modelIndicator.style.zIndex = '1000';
        modelIndicator.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        document.body.appendChild(modelIndicator);
    }
    
    // Get specific model name
    let modelName;
    if (modelType === 'gemini') {
        const storedName = localStorage.getItem('geminiModelName');
        // Convert from API model path to friendly name
        if (storedName && storedName.includes('/')) {
            modelName = storedName.split('/').pop().replace('-', ' ');
        } else {
            modelName = 'Gemini';
        }
    } else if (modelType === 'openai') {
        modelName = localStorage.getItem('openaiModelName') || 'GPT-4o';
    } else {
        modelName = 'Unknown';
    }
    
    // Set styles based on model type
    if (modelType === 'gemini') {
        modelIndicator.textContent = 'Gemini: ' + modelName;
        modelIndicator.style.backgroundColor = '#4285F4';
        modelIndicator.style.color = 'white';
    } else if (modelType === 'openai') {
        modelIndicator.textContent = 'OpenAI: ' + modelName;
        modelIndicator.style.backgroundColor = '#10a37f';
        modelIndicator.style.color = 'white';
    }
}

function createAndConfigureAgent(config, modelType, geminiApiKey, openaiApiKey, deepgramApiKey, toolManager) {
    console.log(`Creating agent with model type: ${modelType}`);
    
    // For OpenAI, only enable text-based communication
    const transcribeUsersSpeech = modelType === 'gemini';
    const transcribeModelsSpeech = modelType === 'gemini';
    
    return new GeminiAgent({
        config,
        modelType,
        geminiApiKey,
        openaiApiKey,
        deepgramApiKey,
        modelSampleRate: MODEL_SAMPLE_RATE,
        transcribeModelsSpeech,
        transcribeUsersSpeech,
        toolManager
    });
}

function setupEventHandlers(agent, chatManager, modelType) {
    let userTranscriptions = [];
    let userTranscriptionTimeout = null;
    
    // Buffer specifically for OpenAI text rendering
    let openAIBuffer = '';
    // Track last fragment to avoid duplicates (OpenAI emits each fragment twice)
    let lastOpenAIFragment = '';

    // Only set up transcription handlers for Gemini
    if (modelType === 'gemini') {
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
    }

    // Common handlers for both models
    agent.on('text_sent', (text) => {
        chatManager.finalizeStreamingMessage();
        chatManager.addUserMessage(text);
    });

    agent.on('interrupted', () => {
        chatManager.finalizeStreamingMessage();
        openAIBuffer = '';
        lastOpenAIFragment = '';
    });

    agent.on('turn_complete', () => {
        chatManager.finalizeStreamingMessage();
        openAIBuffer = '';
        lastOpenAIFragment = '';
    });

    // Direct handling of text events with special handling for OpenAI
    agent.on('text', (text) => {
        if (modelType === 'openai') {
            // Skip empty text fragments
            if (!text || text.trim() === '') {
                return;
            }
            
            // Check for duplicates in OpenAI text events - needed since we're getting
            // events from both model.emit and agent.emit for OpenAI
            if (text === lastOpenAIFragment) {
                console.log('[OpenAI] Skipping duplicate fragment:', text);
                return;
            }
            
            lastOpenAIFragment = text;
            openAIBuffer += text;
            
            try {
                // For OpenAI, we need to ensure a streaming message exists
                if (!chatManager.currentStreamingMessage) {
                    chatManager.startModelMessage();
                }
                
                // Update the accumulated content - this will properly format and display the message
                chatManager.currentStreamedContent = openAIBuffer;
                chatManager.updateStreamingMessage('');
            } catch (error) {
                console.error('[OpenAI] Error updating streaming message:', error);
            }
        } else {
            // For Gemini, continue with existing behavior
            chatManager.updateStreamingMessage(text);
        }
    });
    
    // Add a specific handler for the send button to directly handle text input
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    
    if (sendBtn && messageInput) {
        // Remove any existing listeners to avoid duplicates
        const newSendBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        
        newSendBtn.addEventListener('click', () => {
            const text = messageInput.value.trim();
            if (text) {
                chatManager.addUserMessage(text);
                agent.sendText(text);
                messageInput.value = '';
            }
        });
        
        // Handle enter key in the input field
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                newSendBtn.click();
            }
        });
    }
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