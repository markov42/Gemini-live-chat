import { GeminiAgent } from './main/agent.js';
import { getConfig, getModelType, getGeminiApiKey, getOpenAIApiKey, getDeepgramApiKey, MODEL_SAMPLE_RATE } from './config/config.js';

import { GoogleSearchTool } from './tools/google-search.js';
import { ToolManager } from './tools/tool-manager.js';
import { ChatManager } from './chat/chat-manager.js';

import { setupEventListeners } from './dom/events.js';

const TRANSCRIPTION_DEBOUNCE_MS = 1000;

async function initializeApplication() {
    try {
        const config = getConfig();
        const modelType = getModelType();
        const geminiApiKey = getGeminiApiKey();
        const openaiApiKey = getOpenAIApiKey();
        const deepgramApiKey = getDeepgramApiKey();

        // Validate required API keys
        if (modelType === 'gemini' && !geminiApiKey) {
            throw new Error('Gemini API key is required. Please add it in settings.');
        }
        if (modelType === 'openai' && !openaiApiKey) {
            throw new Error('OpenAI API key is required. Please add it in settings.');
        }

        // Show which model is active
        displayActiveModel(modelType);

        const toolManager = new ToolManager();
        toolManager.registerTool('googleSearch', new GoogleSearchTool());

        const chatManager = new ChatManager();
        window.chatManager = chatManager; // Make it globally accessible

        const agent = createAndConfigureAgent(config, modelType, geminiApiKey, openaiApiKey, deepgramApiKey, toolManager);
        
        // Set up all event handlers before connecting
        setupEventHandlers(agent, chatManager, modelType);
        setupEventListeners(agent);
        
        // Connect and initialize the agent
        try {
            await agent.connect();
            if (agent.initialize) {
                await agent.initialize();
            }
            console.log('Agent initialized successfully');
        } catch (error) {
            console.error("Error initializing agent:", error);
            chatManager.addSystemMessage("Error initializing chat agent. Please check your API keys and settings.");
            throw error; // Re-throw to be caught by outer try-catch
        }
        
        // Store the agent globally for access by event handlers
        window.agent = agent;
        
        return { agent, chatManager };
    } catch (error) {
        console.error("Application initialization error:", error);
        // Show error in UI
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.textContent = `Error: ${error.message}`;
            errorContainer.style.display = 'block';
        }
        
        // Create a minimal chat interface that allows opening settings
        const chatManager = new ChatManager();
        chatManager.addSystemMessage("⚠️ Error: " + error.message);
        chatManager.addSystemMessage("Please check your settings and ensure all required API keys are provided.");
        
        // Enable the settings button
        const settingsButton = document.getElementById('settings-button');
        if (settingsButton) {
            settingsButton.disabled = false;
        }
        
        throw error;
    }
}

function createAndConfigureAgent(config, modelType, geminiApiKey, openaiApiKey, deepgramApiKey, toolManager) {
    console.log(`Creating agent with model type: ${modelType}`);
    
    // Validate API keys again just to be safe
    if (modelType === 'gemini' && !geminiApiKey) {
        throw new Error('Gemini API key is required');
    }
    if (modelType === 'openai' && !openaiApiKey) {
        throw new Error('OpenAI API key is required');
    }
    
    // For OpenAI, only enable text-based communication
    const transcribeUsersSpeech = modelType === 'gemini';
    const transcribeModelsSpeech = modelType === 'gemini';
    
    // Add tool declarations to config
    if (toolManager && toolManager.getToolDeclarations) {
        config.tools = config.tools || {};
        config.tools.functionDeclarations = toolManager.getToolDeclarations();
    }
    
    const agent = new GeminiAgent({
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
    
    return agent;
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

function setupEventHandlers(agent, chatManager, modelType) {
    let userTranscriptions = [];
    let userTranscriptionTimeout = null;

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
                const fullTranscript = userTranscriptions.join(' ');
                userTranscriptions = [];
                agent.sendText(fullTranscript);
            }, 1000); // Wait 1 second after last transcription before sending
        });
    }

    // Handle when text is sent by the user
    agent.on('text_sent', (text) => {
        chatManager.finalizeStreamingMessage(); // Finalize any existing message
        chatManager.addUserMessage(text); // Show the user's message
        chatManager.startModelMessage(); // Prepare for model response
    });
    
    // Handle model content updates (for Gemini)
    agent.on('content', (content) => {
        if (content.modelTurn && content.modelTurn.parts) {
            const textParts = content.modelTurn.parts.filter(p => p.text);
            textParts.forEach(part => {
                chatManager.updateStreamingMessage(part.text);
            });
        }
    });

    // Handle direct text events (for OpenAI)
    agent.model.on('text', (text) => {
        if (!text || text.trim() === '') return;
        chatManager.updateStreamingMessage(text);
    });

    // Handle turn completion
    agent.on('turn_complete', () => {
        console.log('Turn complete, finalizing message');
        chatManager.finalizeStreamingMessage();
    });

    // Handle interruptions
    agent.on('interrupted', () => {
        console.log('Model interrupted, finalizing message');
        chatManager.finalizeStreamingMessage();
    });
    
    // Set up the message input and send button
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    // Create a new send button to replace the old one (to remove old event listeners)
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    newSendBtn.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text) {
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

// Initialize the application when the document is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { agent, chatManager } = await initializeApplication();
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
});