/**
 * Core application class that orchestrates the interaction between various components
 * of the Gemini 2 Live API. Manages audio streaming, WebSocket communication, audio transcription,
 * and coordinates the overall application functionality.
 */
import { GeminiWebsocketClient } from '../ws/client.js';

import { AudioRecorder } from '../audio/recorder.js';
import { AudioStreamer } from '../audio/streamer.js';

import { DeepgramTranscriber } from '../transcribe/deepgram.js';

import { CameraManager } from '../camera/camera.js';
import { ScreenManager } from '../screen/screen.js';

export class GeminiAgent{
    constructor({
        name = 'GeminiAgent',
        url,
        config,
        deepgramApiKey = null,
        transcribeModelsSpeech = true,
        transcribeUsersSpeech = false,
        modelSampleRate = 24000,
        toolManager = null
    } = {}) {
        if (!url) throw new Error('WebSocket URL is required');
        if (!config) throw new Error('Config is required');

        this.initialized = false;
        this.connected = false;

        // For audio components
        this.audioContext = null;
        this.audioRecorder = null;
        this.audioStreamer = null;
        
        // For transcribers
        this.transcribeModelsSpeech = transcribeModelsSpeech;
        this.transcribeUsersSpeech = transcribeUsersSpeech;
        this.deepgramApiKey = deepgramApiKey;
        this.modelSampleRate = modelSampleRate;

        // Initialize screen & camera settings
        this.fps = localStorage.getItem('fps') || '5';
        this.captureInterval = 1000 / this.fps;
        this.resizeWidth = localStorage.getItem('resizeWidth') || '640';
        this.quality = localStorage.getItem('quality') || '0.4';
        
        // Initialize camera
        this.cameraManager = new CameraManager({
            width: this.resizeWidth,
            quality: this.quality,
            facingMode: localStorage.getItem('facingMode') || 'environment'
        });
        this.cameraInterval = null;

        // Initialize screen sharing
        this.screenManager = new ScreenManager({
            width: this.resizeWidth,
            quality: this.quality,
            showSelectionDialog: localStorage.getItem('showScreenSelectionDialog') === 'true',
            onStop: () => {
                // Clean up interval and emit event when screen sharing stops
                if (this.screenInterval) {
                    clearInterval(this.screenInterval);
                    this.screenInterval = null;
                }
                // Emit screen share stopped event
                this.emit('screenshare_stopped');
            }
        });
        this.screenInterval = null;
        
        // Add function declarations to config
        this.toolManager = toolManager;
        config.tools.functionDeclarations = toolManager.getToolDeclarations() || [];
        this.config = config;

        this.name = name;
        this.url = url;
        this.client = null;
    }

    setupEventListeners() {
        // Handle incoming text from the model
        this.client.on('text', (text) => {
            this.emit('text', text);
        });
    
        // Handle incoming audio data from the model
        this.client.on('audio', async (data) => {
            try {
                if (!this.audioStreamer.isInitialized) {
                    this.audioStreamer.initialize();
                }
                this.audioStreamer.streamAudio(new Uint8Array(data));

                // Only connect to model transcriber if we need transcription and it's not already connected
                if (this.modelTranscriber && this.transcribeModelsSpeech) {
                    if (!this.modelTranscriber.isConnected) {
                        console.log("Connecting model transcriber to process received audio");
                        try {
                            await this.modelTranscriber.connect();
                        } catch (e) {
                            console.error("Failed to connect model transcriber:", e);
                        }
                    }
                    
                    if (this.modelTranscriber.isConnected) {
                        this.modelTranscriber.sendAudio(data);
                    }
                }

            } catch (error) {
                throw new Error('Audio processing error:' + error);
            }
        });

        // Handle model interruptions by stopping audio playback
        this.client.on('interrupted', () => {
            this.audioStreamer.stop();
            this.audioStreamer.isInitialized = false;
            this.emit('interrupted');
            
            // Disconnect the model transcriber when audio is interrupted to save resources
            if (this.modelTranscriber && this.modelTranscriber.isConnected) {
                console.log("Disconnecting model transcriber after audio interruption");
                this.modelTranscriber.disconnect();
            }
        });

        // Add an event handler when the model finishes speaking if needed
        this.client.on('turn_complete', () => {
            console.info('Model finished speaking');
            this.emit('turn_complete');
            
            // Disconnect the model transcriber when audio is complete to save resources
            if (this.modelTranscriber && this.modelTranscriber.isConnected) {
                console.log("Disconnecting model transcriber after turn completion");
                this.modelTranscriber.disconnect();
            }
        });

        this.client.on('tool_call', async (toolCall) => {
            await this.handleToolCall(toolCall);
        });
    }
        
    // TODO: Handle multiple function calls
    async handleToolCall(toolCall) {
        const functionCall = toolCall.functionCalls[0];
        const response = await this.toolManager.handleToolCall(functionCall);
        await this.client.sendToolResponse(response);
    }

    /**
     * Connects to the Gemini API using the GeminiWebsocketClient.connect() method.
     */
    async connect() {
        this.client = new GeminiWebsocketClient(this.name, this.url, this.config);
        await this.client.connect();
        this.setupEventListeners();
        this.connected = true;
    }

    /**
     * Sends a text message to the Gemini API.
     * @param {string} text - The text message to send.
     */
    async sendText(text) {
        await this.client.sendText(text);
        this.emit('text_sent', text);
    }

    /**
     * Starts camera capture and sends images at regular intervals
     */
    async startCameraCapture() {
        if (!this.connected) {
            throw new Error('Must be connected to start camera capture');
        }

        try {
            // Before initializing the camera, check if the selected device is available
            const selectedDeviceId = localStorage.getItem('selectedVideoDeviceId');
            
            if (selectedDeviceId && selectedDeviceId !== 'default') {
                try {
                    // Get the list of available video devices
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(device => device.kind === 'videoinput');
                    
                    // Check if the selected device is in the list
                    const deviceExists = videoDevices.some(device => device.deviceId === selectedDeviceId);
                    
                    if (!deviceExists) {
                        console.warn('Selected camera device is no longer available, using default camera instead');
                        // Reset to default camera
                        localStorage.setItem('selectedVideoDeviceId', 'default');
                    }
                } catch (error) {
                    console.warn('Error checking camera availability:', error);
                }
            }
            
            await this.cameraManager.initialize();
            
            // Set up interval to capture and send images
            this.cameraInterval = setInterval(async () => {
                const imageBase64 = await this.cameraManager.capture();
                this.client.sendImage(imageBase64);                
            }, this.captureInterval);
            
            console.info('Camera capture started');
        } catch (error) {
            await this.disconnect();
            throw new Error('Failed to start camera capture: ' + error);
        }
    }

    /**
     * Stops camera capture and cleans up resources
     */
    async stopCameraCapture() {
        if (this.cameraInterval) {
            clearInterval(this.cameraInterval);
            this.cameraInterval = null;
        }
        
        if (this.cameraManager) {
            this.cameraManager.dispose();
        }
        
        console.info('Camera capture stopped');
    }

    /**
     * Starts screen sharing and sends screenshots at regular intervals
     * @param {boolean} [showSelectionDialog] Whether to show the screen selection dialog.
     *                                       If not provided, uses the value from settings.
     */
    async startScreenShare(showSelectionDialog) {
        if (!this.connected) {
            throw new Error('Websocket must be connected to start screen sharing');
        }

        try {
            // If showSelectionDialog parameter is provided, use it, otherwise use the setting from localStorage
            const useSelectionDialog = showSelectionDialog !== undefined ? 
                showSelectionDialog : 
                localStorage.getItem('showScreenSelectionDialog') === 'true';
            
            // Initialize with the appropriate selection dialog setting
            this.screenManager.config.showSelectionDialog = useSelectionDialog;
            await this.screenManager.initialize();
            
            // Set up interval to capture and send screenshots
            this.screenInterval = setInterval(async () => {
                const imageBase64 = await this.screenManager.capture();
                this.client.sendImage(imageBase64);
            }, this.captureInterval);
            
            console.info('Screen sharing started');
        } catch (error) {
            await this.stopScreenShare();
            throw new Error('Failed to start screen sharing: ' + error);
        }
    }

    /**
     * Stops screen sharing and cleans up resources
     */
    async stopScreenShare() {
        if (this.screenInterval) {
            clearInterval(this.screenInterval);
            this.screenInterval = null;
        }
        
        if (this.screenManager) {
            this.screenManager.dispose();
        }
        
        console.info('Screen sharing stopped');
    }

    /**
     * Gracefully terminates all active connections and streams.
     * Ensures proper cleanup of audio, screen sharing, and WebSocket resources.
     */
    async disconnect() {
        try {
            // Stop camera capture first
            await this.stopCameraCapture();

            // Stop screen sharing
            await this.stopScreenShare();

            // Cleanup audio resources in correct order
            if (this.audioRecorder) {
                this.audioRecorder.stop();
                this.audioRecorder = null;
            }

            // Clean up audio streamer before closing context
            if (this.audioStreamer) {
                this.audioStreamer.stop();
                this.audioStreamer = null;
            }

            // Cleanup model's speech transcriber
            if (this.modelTranscriber) {
                this.modelTranscriber.disconnect();
                this.modelTranscriber = null;
            }

            // Cleanup user's speech transcriber
            if (this.userTranscriber) {
                this.userTranscriber.disconnect();
                this.userTranscriber = null;
            }

            // Finally close audio context
            if (this.audioContext) {
                await this.audioContext.close();
                this.audioContext = null;
            }

            // Cleanup WebSocket
            if (this.client) {
                this.client.disconnect();
                this.client = null;
            }
            
            this.initialized = false;
            this.connected = false;
            
            console.info('Disconnected and cleaned up all resources');
        } catch (error) {
            throw new Error('Disconnect error:' + error);
        }
    }

    /**
     * Initializes the model's speech transcriber with Deepgram
     */
    async initializeModelSpeechTranscriber() {
        if (!this.modelTranscriber) {
            console.warn('Either no Deepgram API key provided or model speech transcription disabled');
            return;
        }

        console.info('Initializing Deepgram model speech transcriber...');

        // Just log transcription to console for now
        this.modelTranscriber.on('transcription', (transcript) => {
            this.emit('transcription', transcript);
            console.debug('Model speech transcription:', transcript);
        });

        // Don't auto-connect or set up keep-alive interval
        // Will connect only when needed
    }

    /**
     * Initializes the user's speech transcriber with Deepgram
     */
    async initializeUserSpeechTranscriber() {
        if (!this.userTranscriber) {
            console.warn('Either no Deepgram API key provided or user speech transcription disabled');
            return;
        }

        console.info('Initializing Deepgram user speech transcriber...');

        // Handle user transcription events
        this.userTranscriber.on('transcription', (transcript) => {
            this.emit('user_transcription', transcript);
            console.debug('User speech transcription:', transcript);
        });

        // Don't auto-connect or set up keep-alive interval
        // Will connect only when the microphone is turned on
    }

    /**
     * Initiates audio recording from the microphone.
     * Streams audio data to the model in real-time, handling interruptions
     */
    async initialize() {
        try {            
            // Initialize audio components
            this.audioContext = new AudioContext();
            this.audioStreamer = new AudioStreamer(this.audioContext);
            this.audioStreamer.initialize();
            this.audioRecorder = new AudioRecorder();
            
            // Initialize transcriber objects if API key is provided, but don't connect yet
            if (this.deepgramApiKey) {
                if (this.transcribeModelsSpeech) {
                    this.modelTranscriber = new DeepgramTranscriber(this.deepgramApiKey, this.modelSampleRate);
                    await this.initializeModelSpeechTranscriber();
                    // Only connect when we actually need it (e.g., when receiving audio)
                }
                if (this.transcribeUsersSpeech) {
                    this.userTranscriber = new DeepgramTranscriber(this.deepgramApiKey, 16000);
                    await this.initializeUserSpeechTranscriber();
                    // Will connect only when mic is enabled
                }
            } else {
                console.warn('No Deepgram API key provided, transcription disabled');
            }
            
            this.initialized = true;
            console.info(`${this.client.name} initialized successfully`);
            this.client.sendText('.');  // Trigger the model to start speaking first
        } catch (error) {
            console.error('Initialization error:', error);
            throw new Error('Error during the initialization of the client: ' + error.message);
        }
    }

    async startRecording() {
        // Ensure user transcriber is connected before starting recording
        if (this.userTranscriber && this.transcribeUsersSpeech) {
            try {
                if (!this.userTranscriber.isConnected) {
                    console.log("Connecting user transcriber before starting recording...");
                    await this.userTranscriber.connect();
                    
                    // Small delay to ensure WebSocket is fully established
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (e) {
                console.warn("Failed to connect user transcriber before recording:", e);
                // Continue anyway - we'll try to send audio when possible
            }
        }
        
        // Start recording with callback to send audio data to websocket and transcriber
        await this.audioRecorder.start(async (audioData) => {
            try {
                console.log("Audio data captured, sending to server...", audioData.length);
                this.client.sendAudio(audioData);
                
                // Send to user transcriber if connected and enabled
                if (this.userTranscriber && this.transcribeUsersSpeech) {
                    // Use a non-blocking approach to send audio to transcriber
                    try {
                        if (this.userTranscriber.isConnected && 
                            this.userTranscriber.ws && 
                            this.userTranscriber.ws.readyState === WebSocket.OPEN) {
                            
                            this.userTranscriber.sendAudio(new Uint8Array(audioData));
                        } else if (!this.userTranscriber.isConnected && this.reconnectTranscriberTimeout === undefined) {
                            // Limit reconnection attempts to avoid flooding
                            this.reconnectTranscriberTimeout = setTimeout(async () => {
                                console.log("User transcriber not connected, attempting to reconnect...");
                                try {
                                    await this.userTranscriber.connect();
                                } catch (e) {
                                    console.error("Failed to reconnect user transcriber:", e);
                                }
                                this.reconnectTranscriberTimeout = undefined;
                            }, 2000);
                        }
                    } catch (e) {
                        // Just log and continue - don't interrupt the main audio flow
                        console.warn("Error sending audio to transcriber:", e);
                    }
                }
            } catch (error) {
                console.error('Error sending audio data:', error);
                this.audioRecorder.stop();
            }
        });
        console.log("Audio recording started successfully");
    }

    /**
     * Toggles the microphone state between active and suspended
     */
    async toggleMic() {
        try {
            // Ensure we're connected before toggling
            if (!this.connected) {
                console.info("Not connected. Attempting to connect before toggle mic...");
                await this.connect();
            }
            
            if (!this.audioRecorder.stream) {
                // Starting microphone - ensure transcribers are connected
                if (this.userTranscriber && !this.userTranscriber.isConnected) {
                    console.log("Reconnecting user transcriber before starting recording...");
                    try {
                        await this.userTranscriber.connect();
                    } catch (e) {
                        console.error("Failed to connect user transcriber:", e);
                    }
                }
                
                await this.startRecording();
                return;
            }
            
            // If stopping microphone and was recording, make sure we clean up
            if (!this.audioRecorder.isSuspended) {
                console.log("Stopping microphone recording...");
                
                // Disconnect transcribers when mic is off to prevent timeout errors
                if (this.userTranscriber) {
                    console.log("Disconnecting user transcriber while mic is off");
                    this.userTranscriber.disconnect();
                }
            } else {
                // If resuming microphone, reconnect transcribers
                if (this.userTranscriber && !this.userTranscriber.isConnected && this.transcribeUsersSpeech) {
                    console.log("Reconnecting user transcriber before resuming mic");
                    try {
                        await this.userTranscriber.connect();
                    } catch (e) {
                        console.error("Failed to connect user transcriber:", e);
                    }
                }
            }
            
            // Toggle mic state
            await this.audioRecorder.toggleMic();
            
            // If we just resumed the mic, make sure the WebSocket is open
            if (!this.audioRecorder.isSuspended && (!this.client.ws || this.client.ws.readyState !== WebSocket.OPEN)) {
                console.info("WebSocket not in OPEN state after resuming mic. Attempting to reconnect...");
                await this.client.connect();
            }
        } catch (error) {
            console.error("Error in toggleMic:", error);
            // Try to recover the WebSocket connection if it failed
            if (this.client && (!this.client.ws || this.client.ws.readyState !== WebSocket.OPEN)) {
                try {
                    console.info("Attempting to reconnect WebSocket after error...");
                    await this.client.connect();
                } catch (reconnectError) {
                    console.error("Failed to reconnect WebSocket:", reconnectError);
                }
            }
            throw new Error(`Failed to toggle microphone: ${error.message}`);
        }
    }           

    // Add event emitter functionality
    on(eventName, callback) {
        if (!this._eventListeners) {
            this._eventListeners = new Map();
        }
        if (!this._eventListeners.has(eventName)) {
            this._eventListeners.set(eventName, []);
        }
        this._eventListeners.get(eventName).push(callback);
    }

    emit(eventName, data) {
        if (!this._eventListeners || !this._eventListeners.has(eventName)) {
            return;
        }
        for (const callback of this._eventListeners.get(eventName)) {
            callback(data);
        }
    }
}