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
    return model === 'models/gemini-2.0-flash-exp';
};

export const getConfig = () => ({
    model: localStorage.getItem('selectedModel') || 'models/gemini-2.0-flash-exp',
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
});