/**
 * ModelFactory - Factory for creating model instances
 * Determines which model implementation to use based on configuration
 */
import { GeminiModel } from './gemini-model.js';
import { OpenAIModel } from './openai-model.js';

export class ModelFactory {
    /**
     * Creates a model instance based on the provided type and configuration
     * @param {string} type - The type of model to create ('gemini' or 'openai')
     * @param {Object} config - Configuration for the model
     * @param {Object} keys - API keys for the models
     * @param {string} [keys.geminiApiKey] - API key for Gemini
     * @param {string} [keys.openaiApiKey] - API key for OpenAI
     * @returns {BaseModel} The created model instance
     */
    static createModel(type, config, keys) {
        switch (type.toLowerCase()) {
            case 'gemini':
                if (!keys.geminiApiKey) {
                    throw new Error('Gemini API key is required for Gemini model');
                }
                return new GeminiModel(config, keys.geminiApiKey);
                
            case 'openai':
                if (!keys.openaiApiKey) {
                    throw new Error('OpenAI API key is required for OpenAI model');
                }
                
                // Ensure model name is set correctly for OpenAI
                const openaiConfig = {...config};
                
                // Add a default model name if not provided
                if (!openaiConfig.model) {
                    openaiConfig.model = 'gpt-4o';
                }
                
                return new OpenAIModel(openaiConfig, keys.openaiApiKey);
                
            default:
                throw new Error(`Unknown model type: ${type}`);
        }
    }
} 