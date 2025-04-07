// API and connection configuration
export const getWebsocketUrl = () => {
    const apiKey = localStorage.getItem('geminiApiKey') || localStorage.getItem('apiKey'); // Support legacy key
    return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
};

export const getDeepgramApiKey = () => {
    return localStorage.getItem('deepgramApiKey') || '';
};

export const getOpenAIApiKey = () => {
    return localStorage.getItem('openaiApiKey') || '';
};

export const getGeminiApiKey = () => {
    return localStorage.getItem('geminiApiKey') || localStorage.getItem('apiKey') || ''; // Support legacy key
};

export const getModelType = () => {
    return localStorage.getItem('modelType') || 'gemini';
};

export const getModelName = () => {
    const modelType = getModelType();
    
    if (modelType === 'gemini') {
        return localStorage.getItem('geminiModelName') || 'models/gemini-2.0-flash-exp';
    } else if (modelType === 'openai') {
        return localStorage.getItem('openaiModelName') || 'gpt-4o';
    }
    
    return 'models/gemini-2.0-flash-exp'; // Default to Gemini
};

// Default audio configuration
export const MODEL_SAMPLE_RATE = parseInt(localStorage.getItem('sampleRate')) || 27000;

// Model configuration
export const getConfig = () => {
    const modelType = getModelType();
    const modelName = getModelName();
    
    const config = {
        model: modelName,
        generationConfig: {
            temperature: parseFloat(localStorage.getItem('temperature')) || 1.8,
            top_p: parseFloat(localStorage.getItem('top_p')) || 0.95,
            top_k: parseInt(localStorage.getItem('top_k')) || 65,
            responseModalities: "text"
        },
        systemInstruction: {
            parts: [{
                text: localStorage.getItem('systemInstructions') || `You are a helpful assistant. When greeting the user for the first time, introduce yourself and provide a list of things you can help with, such as:
                
1. Answering questions and providing information on a wide range of topics
2. Assisting with coding tasks and debugging code issues
3. Generating creative content like stories or ideas
4. Explaining complex concepts in simple terms
5. Helping with language translation and grammar
6. Providing recommendations based on user preferences
7. Assisting with math and scientific calculations
8. Helping organize thoughts and plans

Remember to be friendly, helpful, and tailor your responses to the user's needs.`
            }]
        },
        tools: {
            functionDeclarations: [],
        }
    };
    
    return config;
};