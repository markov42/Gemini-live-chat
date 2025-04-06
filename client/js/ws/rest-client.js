/**
 * Client for interacting with the Gemini API via REST API.
 * This class handles the connection, sending messages, and processing responses.
 */

export class GeminiRestClient {
    /**
     * Creates a new GeminiRestClient with the given configuration.
     * @param {string} name - Name for the rest client.
     * @param {string} url - URL for the Gemini API.
     * @param {Object} config - Configuration object for the Gemini API.
     */
    constructor(name, url, config) {
        this._eventListeners = new Map();
        this.name = name || 'RestClient';
        this.url = url;
        this.config = config;
    }

    /**
     * Registers an event listener for the specified event
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} callback - Function to call when the event occurs
     */
    on(eventName, callback) {
        if (!this._eventListeners.has(eventName)) {
            this._eventListeners.set(eventName, []);
        }
        this._eventListeners.get(eventName).push(callback);
    }

    /**
     * Emits an event with the specified data
     * @param {string} eventName - Name of the event to emit
     * @param {any} data - Data to pass to the event listeners
     */
    emit(eventName, data) {
        if (!this._eventListeners.has(eventName)) {
            return;
        }
        for (const callback of this._eventListeners.get(eventName)) {
            callback(data);
        }
    }

    /**
     * Establishes a connection (REST doesn't need actual connection)
     * @returns {Promise} Resolves when initialization is complete
     */
    async connect() {
        // For REST API, there's no persistent connection needed
        console.info(`${this.name} REST API client initialized`);
        // We'll send a setup event to maintain compatibility with WebSocket client
        this.emit('setup_complete');
        return Promise.resolve();
    }

    disconnect() {
        // Nothing to do for REST API
        console.info(`${this.name} disconnected (no-op for REST)`);
    }

    /**
     * Sends a text message to the Gemini API.
     * @param {string} text - The text to send to Gemini.
     * @param {boolean} endOfTurn - Not used in REST API.
     */
    async sendText(text, endOfTurn = true) {
        try {
            console.debug(`Sending text to ${this.name} via REST API:`, text);
            
            // Create request body based on the configuration
            const requestBody = {
                model: this.config.model,
                contents: [
                    // Add system instruction if available
                    ...(this.config.systemInstruction?.parts?.[0]?.text ? [{
                        role: 'user',
                        parts: [{ text: this.config.systemInstruction.parts[0].text }]
                    }] : []),
                    // Add user message
                    {
                        role: 'user',
                        parts: [{ text }]
                    }
                ],
                generationConfig: {
                    temperature: this.config.generationConfig.temperature,
                    topP: this.config.generationConfig.top_p,
                    topK: this.config.generationConfig.top_k,
                }
            };

            // Make the API request
            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error (${response.status}):`, errorText);
                
                // Try to parse error JSON for better error messages
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.error) {
                        // For model not found/supported errors, provide a helpful message
                        if (errorJson.error.code === 404 && errorJson.error.message.includes("is not found")) {
                            // Extract model name from config
                            const modelName = this.config.model.replace('models/', '');
                            
                            // Create custom message for experimental models
                            if (modelName === 'gemini-2.5-pro') {
                                let errorMessage = `The model "${modelName}" isn't available yet or is still in private preview.\n\n`;
                                errorMessage += "To force using this experimental model without fallback, please:\n";
                                errorMessage += "1. Open developer console (F12)\n";
                                errorMessage += "2. Run: localStorage.setItem('enforceExperimentalModels', 'true')\n";
                                errorMessage += "3. Reload the page\n\n";
                                errorMessage += "For now, Gemini 2.0 Flash will be used as a fallback.\n";
                                errorMessage += "You can also try these other stable models:\n";
                                errorMessage += "- gemini-1.5-pro\n";
                                errorMessage += "- gemini-1.5-flash\n";
                                errorMessage += "- gemini-pro";
                                
                                this.emit('text', errorMessage);
                                this.emit('turn_complete');
                                return;
                            }
                            
                            // General error for other models
                            let errorMessage = `The model "${modelName}" is not available. Please try one of these models instead:\n`;
                            errorMessage += "- gemini-1.5-pro (Gemini 1.5 Pro)\n";
                            errorMessage += "- gemini-1.5-flash (Gemini 1.5 Flash)\n";
                            errorMessage += "- gemini-pro (Gemini 1.0 Pro)";
                            
                            this.emit('text', errorMessage);
                            this.emit('turn_complete');
                            return;
                        }
                    }
                } catch (parseError) {
                    // If we can't parse the error, just continue with the original error
                    console.warn("Could not parse error JSON:", parseError);
                }
                
                throw new Error(`API error (${response.status}): ${errorText}`);
            }

            // Parse and process the response
            const data = await response.json();
            console.debug(`Response from ${this.name}:`, data);

            // Extract the text from the response
            if (data.candidates && data.candidates.length > 0 && 
                data.candidates[0].content && 
                data.candidates[0].content.parts && 
                data.candidates[0].content.parts.length > 0) {
                
                // Add model information to the response if available
                if (data.model) {
                    const modelName = data.model.split('/').pop();
                    console.log(`Response from model: ${data.model}`);
                    // Emit model info event for UI updates
                    this.emit('model_info', data.model);
                }
                
                // Process each part of the response
                for (const part of data.candidates[0].content.parts) {
                    if (part.text) {
                        // Emit text event for each part
                        this.emit('text', part.text);
                    }
                }
                
                // Emit complete event
                this.emit('turn_complete');
            } else {
                console.error(`No valid response from ${this.name}`);
                this.emit('text', "Sorry, I couldn't generate a response. Please try again.");
                this.emit('turn_complete');
            }
        } catch (error) {
            console.error(`Error sending text to ${this.name}:`, error);
            this.emit('text', `Sorry, an error occurred: ${error.message}`);
            this.emit('turn_complete');
        }
    }

    /**
     * Send tool response (not implemented for REST API yet)
     */
    async sendToolResponse(toolResponse) {
        console.warn("Tool responses are not supported in REST API mode");
    }
} 