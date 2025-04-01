/**
 * Establishes a websocket connection to Deepgram API
 * for real-time audio transcription
 * Utilizes Free Tier of Deepgram API
 */
export class DeepgramTranscriber {
    constructor(apiKey, sampleRate) {
        this.apiKey = apiKey;
        this.ws = null;
        this.isConnected = false;
        this.eventListeners = new Map();
        this.sampleRate = sampleRate;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.pendingAudio = [];
        this.heartbeatInterval = null;
        // Set a short timeout for connections so they don't stay open indefinitely
        this.connectionTimeout = 60000; // 60 seconds max idle time
        console.info('DeepgramTranscriber initialized');
    }

    async connect() {
        // If already connecting, don't create multiple WebSockets
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            console.log("Connection already in progress, waiting...");
            return;
        }
        
        try {
            const url = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=${this.sampleRate}`;
            console.info('Attempting to connect to Deepgram WebSocket...');
            
            // Clean up any existing connection first
            if (this.ws) {
                try {
                    this.ws.close();
                } catch (e) {}
                this.ws = null;
            }
            
            // Create WebSocket with authorization in protocol
            this.ws = new WebSocket(url, ['token', this.apiKey]);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                console.info('WebSocket connection established');
                
                // Wait a short time to ensure the connection is fully established
                setTimeout(() => {
                    try {
                        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                            const config = {
                                type: 'Configure',
                                features: {
                                    model: 'nova-2',
                                    language: 'en-US',
                                    encoding: 'linear16',
                                    sample_rate: this.sampleRate,
                                    channels: 1,
                                    interim_results: false,
                                    punctuate: true,
                                    endpointing: 800
                                },
                            };
                            
                            console.debug('Sending configuration:', config);
                            this.ws.send(JSON.stringify(config));
                            this.isConnected = true;
                            this.reconnectAttempts = 0;
                            
                            // Send any pending audio chunks after a short delay to ensure config is processed
                            if (this.pendingAudio.length > 0) {
                                setTimeout(() => {
                                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                                        console.log(`Sending ${this.pendingAudio.length} pending audio chunks`);
                                        // Only send the most recent chunks to avoid flooding
                                        const recentChunks = this.pendingAudio.slice(-5); 
                                        recentChunks.forEach(audioData => {
                                            try {
                                                this.ws.send(audioData);
                                            } catch (e) {
                                                console.warn("Error sending pending audio:", e);
                                            }
                                        });
                                        this.pendingAudio = [];
                                    }
                                }, 500);
                            }
                            
                            // Set timeout to auto-disconnect after idle period (instead of heartbeat)
                            this.connectionTimeoutId = setTimeout(() => {
                                console.log("Auto-disconnecting Deepgram due to inactivity");
                                this.disconnect();
                            }, this.connectionTimeout);
                            
                            this.emit('connected');
                        } else {
                            console.warn(`WebSocket not ready: ${this.ws ? this.ws.readyState : 'null'}`);
                        }
                    } catch (error) {
                        console.error('Error during WebSocket setup:', error);
                    }
                }, 1000); // Increase delay to 1000ms to ensure WebSocket is fully established
            };

            this.ws.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    if (response.type === 'Results') {
                        const transcript = response.channel?.alternatives[0]?.transcript;

                        if (transcript && transcript.trim()) {
                            console.debug('Received transcript:', transcript);
                            this.emit('transcription', transcript);
                        }
                    } else {
                        console.debug('Received Deepgram message type:', response.type);
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                    this.emit('error', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                this.emit('error', error);
            };

            this.ws.onclose = (event) => {
                console.info(`WebSocket connection closed: ${event.code} - ${event.reason}`);
                this.isConnected = false;
                
                // Clear heartbeat interval if set
                if (this.heartbeatInterval) {
                    clearInterval(this.heartbeatInterval);
                    this.heartbeatInterval = null;
                }
                
                this.emit('disconnected');
                
                // Don't attempt to reconnect for normal closures or timeouts during inactive periods
                const isNormalClosure = event.code === 1000;
                const isTimeoutDuringInactive = event.code === 1011 && event.reason.includes('timeout');
                
                // Only attempt reconnection for unexpected closures during active recording
                if (!isNormalClosure && !isTimeoutDuringInactive && this.reconnectAttempts < this.maxReconnectAttempts) {
                    console.info(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        this.connect();
                    }, this.reconnectDelay * this.reconnectAttempts);
                } else if (isTimeoutDuringInactive) {
                    console.log("Deepgram timeout during inactive period - will reconnect when needed");
                }
            };

        } catch (error) {
            console.error('Error in connect():', error);
            throw error;
        }
    }

    sendAudio(audioData) {
        // Reset the auto-disconnect timeout whenever we send audio
        if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
            this.connectionTimeoutId = setTimeout(() => {
                console.log("Auto-disconnecting Deepgram due to inactivity");
                this.disconnect();
            }, this.connectionTimeout);
        }
        
        if (!this.ws) {
            console.warn('Cannot send audio: WebSocket is null');
            // Store the audio for later transmission (limit to last 10 chunks)
            this.pendingAudio.push(audioData);
            if (this.pendingAudio.length > 10) {
                this.pendingAudio = this.pendingAudio.slice(-10); // Keep only latest chunks
            }
            
            // Try to reconnect if not already attempting
            if (this.reconnectAttempts === 0) {
                console.info('Attempting to reconnect WebSocket...');
                this.connect();
            }
            return;
        }
        
        // Check if WebSocket is in a state that can accept messages
        if (this.ws.readyState !== WebSocket.OPEN) {
            // Silently queue the audio if not in OPEN state (no error)
            this.pendingAudio.push(audioData);
            if (this.pendingAudio.length > 10) {
                this.pendingAudio = this.pendingAudio.slice(-10);
            }
            
            // If it's still connecting, just queue the audio
            if (this.ws.readyState === WebSocket.CONNECTING) {
                return;
            }
            
            // If closed or closing, reconnect without logging every time
            if (this.reconnectAttempts === 0) {
                this.connect();
            }
            return;
        }
        
        try {
            this.ws.send(audioData);
        } catch (error) {
            // Don't log every error - just handle it gracefully
            this.pendingAudio.push(audioData);
            if (this.pendingAudio.length > 10) {
                this.pendingAudio = this.pendingAudio.slice(-10);
            }
            
            // Connection might be broken, attempt to reconnect
            this.isConnected = false;
            if (this.reconnectAttempts === 0) {
                this.connect();
            }
        }
    }

    disconnect() {
        // Clear the auto-disconnect timeout
        if (this.connectionTimeoutId) {
            clearTimeout(this.connectionTimeoutId);
            this.connectionTimeoutId = null;
        }
        
        if (this.ws) {
            try {
                // Clear heartbeat interval
                if (this.heartbeatInterval) {
                    clearInterval(this.heartbeatInterval);
                    this.heartbeatInterval = null;
                }
                
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'CloseStream' }));
                    this.ws.close(1000, "Normal closure");
                }
            } catch (e) {
                console.warn('Error during clean disconnect:', e);
            }
            this.ws = null;
            this.isConnected = false;
            this.reconnectAttempts = 0;
            this.pendingAudio = [];
        }
    }

    on(eventName, callback) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(callback);
    }

    emit(eventName, data) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }
}