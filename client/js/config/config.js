export const getWebsocketUrl = () => {
    const apiKey = localStorage.getItem('apiKey');
    return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
};

export const getRestApiUrl = (model) => {
    const apiKey = localStorage.getItem('apiKey');
    return `https://generativelanguage.googleapis.com/v1/${model}:generateContent?key=${apiKey}`;
};

export const getDeepgramApiKey = () => {
    return localStorage.getItem('deepgramApiKey') || '';
};

// Audio Configurations
export const MODEL_SAMPLE_RATE = parseInt(localStorage.getItem('sampleRate')) || 27000;

// Check if the selected model supports streaming or requires REST API
export const isStreamingModel = (model) => {
    // Currently only Gemini 2.0 Flash supports the WebSocket streaming API for audio and video
    // All other models use the REST API
    const streamingModels = [
        'models/gemini-2.0-flash-exp'
    ];
    return streamingModels.includes(model);
};

// Get a valid model, with fallbacks for newer models that might not be available yet
export const getSafeModel = (selectedModel) => {
    // If the model is one of the well-established ones, use it directly
    const stableModels = [
        'models/gemini-pro',
        'models/gemini-1.5-pro',
        'models/gemini-1.5-flash',
        'models/gemini-2.0-flash-exp'
    ];
    
    if (stableModels.includes(selectedModel)) {
        return selectedModel;
    }
    
    // For newer or experimental models, provide fallbacks
    const modelFallbacks = {
        'models/gemini-2.5-pro': 'models/gemini-2.0-flash-exp' // Fall back to 2.0 Flash if 2.5 isn't available
    };
    
    // Check if we need to use a fallback
    if (modelFallbacks[selectedModel]) {
        // Don't use fallback option if user specifically wants to use the experimental model
        const enforcedModelMode = localStorage.getItem('enforceExperimentalModels') === 'true';
        if (enforcedModelMode) {
            console.warn(`Using experimental model: ${selectedModel} as requested (enforced mode)`);
            return selectedModel;
        }
        
        console.warn(`Model ${selectedModel} might not be available yet. Using fallback: ${modelFallbacks[selectedModel]}`);
        return modelFallbacks[selectedModel];
    }
    
    // Default fallback to Gemini 1.5 Pro for any other models
    return selectedModel;
};

export const getConfig = () => {
    const selectedModel = localStorage.getItem('selectedModel') || 'models/gemini-2.0-flash-exp';
    
    return {
        // Use the potentially safer model name
        model: selectedModel,
        generationConfig: {
            temperature: parseFloat(localStorage.getItem('temperature')) || 1.8,
            top_p: parseFloat(localStorage.getItem('top_p')) || 0.95,
            top_k: parseInt(localStorage.getItem('top_k')) || 65,
            responseModalities: "text",
            speechConfig: {
                voiceConfig: { 
                    prebuiltVoiceConfig: { 
                        voiceName: localStorage.getItem('voiceName') || 'Aoede'
                    }
                }
            }
        },
        systemInstruction: {
            parts: [{
                text: localStorage.getItem('systemInstructions') || "You are a helpful assistant"
            }]
        },
        tools: {
            functionDeclarations: [],
        }
    }
};