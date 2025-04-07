/**
 * GeminiModel - Implementation of the BaseModel for Google's Gemini API
 * Uses WebSocket communication for real-time interaction with Gemini
 */
import { BaseModel } from './base-model.js';
import { blobToJSON, base64ToArrayBuffer } from '../utils/utils.js';

export class GeminiModel extends BaseModel {
    /**
     * Creates a new GeminiModel instance
     * @param {Object} config - Configuration for the Gemini model
     * @param {string} apiKey - Google API key for Gemini access
     */
    constructor(config, apiKey) {
        super(config);
        
        if (!apiKey) {
            throw new Error('API key is required for Gemini model');
        }
        
        this.apiKey = apiKey;
        this.url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
        this.ws = null;
        this.isConnecting = false;
        this.connectionPromise = null;
        this.lastEmittedText = '';
    }

    /**
     * Establishes a WebSocket connection to the Gemini API
     * @returns {Promise} Resolves when the connection is established
     */
    async connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return this.connectionPromise;
        }

        if (this.isConnecting) {
            return this.connectionPromise;
        }

        console.info('🔗 Establishing Gemini WebSocket connection...');
        this.isConnecting = true;
        this.connectionPromise = new Promise((resolve, reject) => {
            const ws = new WebSocket(this.url);

            // Send setup message upon successful connection
            ws.addEventListener('open', () => {
                console.info('🔗 Successfully connected to Gemini websocket');
                this.ws = ws;
                this.isConnecting = false;
                this.isConnected = true;

                // Configure
                this.sendJSON({ setup: this.config });
                console.debug("Setup message with the following configuration was sent:", this.config);
                resolve();
            });

            // Handle connection errors
            ws.addEventListener('error', (error) => {
                this.disconnect();
                const reason = error.reason || 'Unknown';
                const message = `Could not connect to Gemini API. Reason: ${reason}`;
                console.error(message, error);
                reject(error);
            });

            // Listen for incoming messages, expecting Blob data for binary streams
            ws.addEventListener('message', async (event) => {
                if (event.data instanceof Blob) {
                    this.receive(event.data);
                } else {
                    console.error('Non-blob message received from Gemini API', event);
                }
            });
        });

        return this.connectionPromise;
    }

    /**
     * Disconnects from the Gemini API
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnecting = false;
            this.isConnected = false;
            this.connectionPromise = null;
            console.info('Successfully disconnected from Gemini websocket');
        }
    }

    /**
     * Processes incoming WebSocket messages from Gemini
     * @param {Blob} blob - The raw message data
     */
    async receive(blob) {
        try {
            const response = await blobToJSON(blob);
            console.log('Received response from Gemini:', JSON.stringify(response).substring(0, 200) + "...");
            
            // Handle tool call responses
            if (response.toolCall) {
                console.debug('Received tool call from Gemini', response);       
                this.emit('tool_call', response.toolCall);
                return;
            }

            // Handle tool call cancellation
            if (response.toolCallCancellation) {
                console.debug('Received tool call cancellation from Gemini', response);
                this.emit('tool_call_cancellation', response.toolCallCancellation);
                return;
            }

            // Process server content (text/audio/interruptions)
            if (response.serverContent) {
                const { serverContent } = response;
                if (serverContent.interrupted) {
                    console.debug('Gemini response was interrupted');
                    this.emit('interrupted');
                    return;
                }
                if (serverContent.turnComplete) {
                    console.debug('Gemini has completed its turn');
                    this.emit('turn_complete');
                }
                if (serverContent.modelTurn) {
                    // Split content into text, audio, and non-audio parts
                    let parts = serverContent.modelTurn.parts;
                    console.log('Gemini model turn, parts count:', parts.length);
                
                    // Handle text parts
                    const textParts = parts.filter((p) => p.text);
                    console.log('Gemini text parts:', textParts.length);

                    // Process text parts in order
                    if (textParts.length > 0) {
                        // Get the latest text part as it contains the most complete content
                        const latestPart = textParts[textParts.length - 1];
                        if (latestPart.text && latestPart.text.trim()) {
                            // Only emit if the text is different from what we've seen
                            if (latestPart.text !== this.lastEmittedText) {
                                this.lastEmittedText = latestPart.text;
                                this.emit('text', latestPart.text);
                            }
                        }
                    }

                    // Filter out audio parts from the model's content parts
                    const audioParts = parts.filter((p) => p.inlineData && p.inlineData.mimeType.startsWith('audio/pcm'));
                    console.log('Gemini audio parts:', audioParts.length);
                    
                    // Extract base64 encoded audio data from the audio parts
                    const base64s = audioParts.map((p) => p.inlineData?.data);
                    
                    // Create an array of non-audio parts by excluding the audio parts
                    const otherParts = parts.filter((p) => !audioParts.includes(p));

                    // Process audio data
                    base64s.forEach((b64) => {
                        if (b64) {
                            const data = base64ToArrayBuffer(b64);
                            this.emit('audio', data);
                        }
                    });

                    // Emit remaining content
                    if (otherParts.length) {
                        this.emit('content', { modelTurn: { parts: otherParts } });
                        console.debug('Sent other parts from Gemini:', otherParts);
                    }
                }
            } else {
                console.debug('Received unmatched message from Gemini:', response);
            }
        } catch (error) {
            console.error("Error processing Gemini WebSocket response:", error);
        }
    }

    /**
     * Helper method to send JSON data over the WebSocket
     * @param {Object} data - The data to send
     */
    async sendJSON(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.connect();
        }
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            throw new Error('WebSocket is not in OPEN state');
        }
    }

    /**
     * Sends a text message to the Gemini API
     * @param {string} text - The text to send
     * @param {boolean} endOfTurn - Whether this is the end of the user's turn
     */
    async sendText(text, endOfTurn = true) {
        const formattedText = { 
            clientContent: { 
                turns: [{
                    role: 'user', 
                    parts: { text: text }
                }], 
                turnComplete: endOfTurn 
            } 
        };
        await this.sendJSON(formattedText);
        console.debug('Text sent to Gemini:', text);
    }

    /**
     * Sends an image to the Gemini API
     * @param {string} base64image - Base64 encoded image data
     */
    async sendImage(base64image) {
        const data = { realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: base64image }] } };
        await this.sendJSON(data);
        console.debug(`Image with size of ${Math.round(base64image.length/1024)} KB sent to Gemini.`);
    }

    /**
     * Sends audio data to the Gemini API
     * @param {string} base64audio - Base64 encoded audio data
     */
    async sendAudio(base64audio) {
        const data = { realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm', data: base64audio }] } };
        console.log(`Sending audio chunk to Gemini, size: ${base64audio.length} chars`);
        try {
            await this.sendJSON(data);
        } catch (error) {
            console.error("Error sending audio to Gemini:", error);
        }
    }

    /**
     * Sends a tool/function response back to Gemini
     * @param {Object} toolResponse - The response from a tool call
     */
    async sendToolResponse(toolResponse) {
        if (!toolResponse || !toolResponse.id) {
            throw new Error('Tool response must include an id');
        }

        const request = {
            toolResult: {
                functionResponse: {
                    name: toolResponse.name,
                    response: {
                        id: toolResponse.id,
                        output: toolResponse.output,
                        error: toolResponse.error
                    }
                }
            }
        };

        await this.sendJSON(request);
        console.debug('Tool response sent to Gemini:', toolResponse);
    }
} 