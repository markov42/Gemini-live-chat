/**
 * OpenAIModel - Implementation of the BaseModel for OpenAI's API
 * Uses fetch API for communication with OpenAI
 */
import { BaseModel } from './base-model.js';

export class OpenAIModel extends BaseModel {
    /**
     * Creates a new OpenAIModel instance
     * @param {Object} config - Configuration for the OpenAI model
     * @param {string} apiKey - OpenAI API key
     */
    constructor(config, apiKey) {
        super(config);
        
        if (!apiKey) {
            throw new Error('API key is required for OpenAI model');
        }
        
        // Trim the API key to remove any whitespace that might have been accidentally added
        this.apiKey = apiKey.trim();
        this.baseUrl = 'https://api.openai.com/v1';
        this.modelName = config.model || 'gpt-4o';
        this.conversation = [];
        this.currentController = null; // For cancelling ongoing requests
        this.readingStream = false;
        this.lastEmittedContent = ''; // Track last emitted content to avoid duplicates
        
        console.log('OpenAI model initialized with model:', this.modelName);
        console.log('API key length:', this.apiKey.length);
    }

    /**
     * Establishes a connection to the OpenAI API
     * This is a no-op for OpenAI as we use REST API calls
     */
    async connect() {
        console.info('OpenAI model ready (no persistent connection needed)');
        
        // Validate the API key by making a small test request
        try {
            // Just perform a basic health check to see if we can reach the API
            const testMessage = {
                model: this.modelName,
                messages: [
                    {role: "system", content: "Hello! This is a test message."},
                    {role: "user", content: "Hi"}
                ],
                max_tokens: 1 // Just request minimal tokens for the test
            };
            
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(testMessage)
            });
            
            if (!response.ok) {
                let errorInfo = "Unknown error";
                try {
                    const errorData = await response.json();
                    errorInfo = errorData.error?.message || JSON.stringify(errorData);
                } catch (e) {
                    errorInfo = await response.text();
                }
                console.error('OpenAI API key validation failed:', errorInfo);
                throw new Error(`OpenAI API key validation failed: ${errorInfo}`);
            }
            
            console.log('OpenAI API key validated successfully');
            this.isConnected = true;
            return Promise.resolve();
        } catch (error) {
            console.error('Error validating OpenAI API key:', error);
            throw error;
        }
    }

    /**
     * Disconnects from the OpenAI API
     * Cancels any ongoing requests
     */
    disconnect() {
        if (this.currentController) {
            this.currentController.abort();
            this.currentController = null;
        }
        this.isConnected = false;
        console.info('Disconnected from OpenAI API');
    }

    /**
     * Sends a text message to the OpenAI API
     * @param {string} text - The text to send
     * @param {boolean} endOfTurn - Whether this is the end of the user's turn
     */
    async _sendTextImplementation(text, endOfTurn = true) {
        console.log('[OpenAI] Sending text:', text);
        
        // Add the user message to the conversation history
        this.conversation.push({
            role: 'user',
            content: text
        });

        // Ensure any previous request is done
        if (this.readingStream) {
            this.cancelCurrentRequest();
            await new Promise(resolve => setTimeout(resolve, 100)); // Give time for cleanup
        }

        if (endOfTurn) {
            await this.sendRequest();
        }
        
        console.debug('Text sent to OpenAI:', text);
    }

    /**
     * Sends an image to the OpenAI API
     * Stores it to be sent with the next text message
     * @param {string} base64image - Base64 encoded image data
     */
    async sendImage(base64image) {
        // Add the image to the conversation as a separate message or part
        // The exact format depends on which model is being used
        const imageUrl = `data:image/jpeg;base64,${base64image}`;
        
        // Add the image to the conversation history
        // If the last message is from the user and doesn't have content yet, attach to it
        const lastMessage = this.conversation[this.conversation.length - 1];
        
        if (lastMessage && lastMessage.role === 'user' && !lastMessage.content) {
            // Add the image to the existing message
            lastMessage.content = [
                {
                    type: 'image_url',
                    image_url: {
                        url: imageUrl
                    }
                }
            ];
        } else {
            // Create a new message for the image
            this.conversation.push({
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageUrl
                        }
                    }
                ]
            });
        }
        
        console.debug(`Image with size of ${Math.round(base64image.length/1024)} KB prepared for OpenAI.`);
    }

    /**
     * Not supported by OpenAI API in the same way as Gemini
     * @param {string} base64audio - Base64 encoded audio data
     */
    async sendAudio(base64audio) {
        console.warn('Direct audio streaming not supported by OpenAI model implementation');
        // Could be implemented using Whisper API for transcription first
    }

    /**
     * Sends a tool/function response back to OpenAI
     * @param {Object} toolResponse - The response from a tool call
     */
    async sendToolResponse(toolResponse) {
        if (!toolResponse || !toolResponse.id) {
            throw new Error('Tool response must include an id');
        }

        // Add tool response to conversation
        this.conversation.push({
            role: 'tool',
            tool_call_id: toolResponse.id,
            name: toolResponse.name,
            content: toolResponse.error ? toolResponse.error : JSON.stringify(toolResponse.output)
        });

        // Send the updated conversation to get the model's response
        await this.sendRequest();
        
        console.debug('Tool response sent to OpenAI:', toolResponse);
    }

    /**
     * Sends the current conversation to the OpenAI API
     * and processes the streaming response
     */
    async sendRequest() {
        console.log('[OpenAI] Starting request with API key available:', !!this.apiKey);
        console.log('[OpenAI] Conversation history length:', this.conversation.length);
        
        if (this.readingStream) {
            this.cancelCurrentRequest();
        }

        // Don't send empty conversations
        if (this.conversation.length === 0) {
            console.log('[OpenAI] Skipping request - empty conversation');
            return;
        }

        this.currentController = new AbortController();
        this.readingStream = true;
        
        const messages = this.conversation.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
            ...(msg.name && { name: msg.name }),
            ...(msg.tool_calls && { tool_calls: msg.tool_calls })
        }));

        console.log('[OpenAI] Preparing request with model:', this.modelName);
        console.log('[OpenAI] Message count:', messages.length);
        
        const requestBody = {
            model: this.modelName,
            messages: messages,
            stream: true
        };

        // Add function definitions if available
        const functions = this.prepareFunctionDefinitions();
        if (functions) {
            requestBody.tools = functions;
        }

        try {
            console.log('[OpenAI] Sending request to API');
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: this.currentController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!response.body) {
                throw new Error('ReadableStream not supported');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            console.log('[OpenAI] Response received, starting stream processing');

            while (true) {
                const { value, done } = await reader.read();
                
                if (done) {
                    console.log('[OpenAI] Stream complete');
                    this.readingStream = false;
                    this.emit('turn_complete');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (!line.trim() || line.trim() === 'data: [DONE]') continue;
                    
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonLine = line.replace(/^data: /, '').trim();
                            const data = JSON.parse(jsonLine);
                            const content = data.choices?.[0]?.delta?.content;
                            if (content !== undefined) { // Include all content, even empty strings
                                this.emit('text', content);
                            }
                            
                            // Handle function call deltas
                            const toolCallDelta = data.choices?.[0]?.delta?.tool_calls;
                            if (toolCallDelta) {
                                this.handleToolCallDelta(toolCallDelta);
                            }
                        } catch (error) {
                            console.error('Error parsing stream:', error);
                        }
                    }
                }
            }

            // Add any remaining buffer content
            if (buffer.trim()) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                    if (line.trim() && !line.includes('[DONE]')) {
                        try {
                            const jsonLine = line.replace(/^data: /, '').trim();
                            const data = JSON.parse(jsonLine);
                            const content = data.choices?.[0]?.delta?.content;
                            if (content) {
                                this.emit('text', content);
                            }
                        } catch (error) {
                            console.error('Error parsing final buffer:', error);
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[OpenAI] Request cancelled');
            } else {
                console.error('[OpenAI] Error during streaming:', error);
                throw error;
            }
        } finally {
            this.readingStream = false;
            this.currentController = null;
            this.emit('turn_complete'); // Add turn_complete event when stream is done
        }
    }

    /**
     * Handles tool call deltas from the streaming response
     * Accumulates them until complete and then emits a tool_call event
     */
    handleToolCallDelta(toolCallDelta) {
        // This is simplified - a full implementation would need to handle
        // partial function calls across multiple chunks
        // For now, assume we get the complete call in one go
        if (toolCallDelta?.[0]?.function?.name && toolCallDelta?.[0]?.function?.arguments) {
            try {
                const functionName = toolCallDelta[0].function.name;
                const argsString = toolCallDelta[0].function.arguments;
                const args = JSON.parse(argsString);
                const id = toolCallDelta[0].id;
                
                // Format it like Gemini's tool call for compatibility
                const toolCall = {
                    functionCalls: [{
                        id: id,
                        name: functionName,
                        args: args
                    }]
                };
                
                this.emit('tool_call', toolCall);
                
                // Add the tool call to the conversation
                this.conversation.push({
                    role: 'assistant',
                    content: null,
                    tool_calls: [{
                        id: id,
                        type: 'function',
                        function: {
                            name: functionName,
                            arguments: argsString
                        }
                    }]
                });
            } catch (err) {
                console.error('Error processing tool call:', err);
            }
        }
    }

    /**
     * Cancels the current OpenAI request if there is one
     */
    cancelCurrentRequest() {
        if (this.currentController) {
            this.currentController.abort();
            this.currentController = null;
            this.readingStream = false;
            this.emit('interrupted');
        }
    }

    /**
     * Prepares function definitions for the OpenAI API from the Gemini format
     */
    prepareFunctionDefinitions() {
        if (!this.config.tools?.functionDeclarations || this.config.tools.functionDeclarations.length === 0) {
            return null;
        }

        // Transform Gemini function declarations to OpenAI format
        return this.config.tools.functionDeclarations.map(fnDecl => {
            return {
                type: 'function',
                function: {
                    name: fnDecl.name,
                    description: fnDecl.description,
                    parameters: fnDecl.parameters
                }
            };
        });
    }
} 