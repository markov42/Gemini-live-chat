/**
 * Core application class that orchestrates the interaction between various components
 * of the AI Live API. Manages audio streaming, model communication, audio transcription,
 * and coordinates the overall application functionality.
 */
import { ModelFactory } from '../models/model-factory.js';

import { AudioRecorder } from '../audio/recorder.js';
import { AudioStreamer } from '../audio/streamer.js';

import { DeepgramTranscriber } from '../transcribe/deepgram.js';

import { CameraManager } from '../camera/camera.js';
import { ScreenManager } from '../screen/screen.js';

export class GeminiAgent{
    constructor({
        name = 'GeminiAgent',
        config,
        modelType = 'gemini',
        geminiApiKey = null,
        openaiApiKey = null,
        deepgramApiKey = null,
        transcribeModelsSpeech = true,
        transcribeUsersSpeech = false,
        modelSampleRate = 24000,
        toolManager = null
    } = {}) {
        if (!config) throw new Error('Config is required');
        
        // Check for necessary API keys based on model type
        if (modelType === 'gemini' && !geminiApiKey) {
            throw new Error('Gemini API key is required when using the Gemini model');
        }
        
        if (modelType === 'openai' && !openaiApiKey) {
            throw new Error('OpenAI API key is required when using the OpenAI model');
        }

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
        this.modelType = modelType;
        
        // Create the appropriate model instance using the factory
        this.model = ModelFactory.createModel(modelType, config, {
            geminiApiKey,
            openaiApiKey
        });
        
        // Set up event listeners
        this._eventListeners = new Map();
    }

    setupEventListeners() {
        console.log(`Setting up event listeners for ${this.modelType} model`);
        
        // Handle incoming text from the model
        this.model.on('text', (text) => {
            // Directly pass through text fragments as they arrive
            if (text && text.trim()) {
                // We need to emit text events for all models, including OpenAI
                this.emit('text', text);
            }
        });
    
        // Handle incoming audio data from the model
        this.model.on('audio', async (data) => {
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
                console.error('Audio processing error:', error);
            }
        });

        // Handle model interruptions by stopping audio playback
        this.model.on('interrupted', () => {
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
        this.model.on('turn_complete', () => {
            console.info('Model finished speaking');
            this.emit('turn_complete');
            
            // Disconnect the model transcriber when audio is complete to save resources
            if (this.modelTranscriber && this.modelTranscriber.isConnected) {
                console.log("Disconnecting model transcriber after turn completion");
                this.modelTranscriber.disconnect();
            }
        });

        this.model.on('tool_call', async (toolCall) => {
            console.log(`Received tool call from ${this.modelType} model`, toolCall);
            await this.handleToolCall(toolCall);
        });
    }
        
    // TODO: Handle multiple function calls
    async handleToolCall(toolCall) {
        console.log(`Handling tool call in ${this.modelType} agent`);
        const functionCall = toolCall.functionCalls[0];
        const response = await this.toolManager.handleToolCall(functionCall);
        await this.model.sendToolResponse(response);
    }

    /**
     * Connects to the Gemini API using the GeminiWebsocketClient.connect() method.
     */
    async connect() {
        console.log(`Connecting to ${this.modelType} model...`);
        try {
            await this.model.connect();
            this.setupEventListeners();
            this.connected = true;
            console.log(`Successfully connected to ${this.modelType} model`);
        } catch (error) {
            console.error(`Error connecting to ${this.modelType} model:`, error);
            throw error;
        }
    }

    /**
     * Sends a text message to the model.
     * @param {string} text - The text message to send.
     */
    async sendText(text) {
        console.log(`Sending text to ${this.modelType} model:`, text);
        await this.model.sendText(text);
        this.emit('text_sent', text);
    }

    /**
     * Initialize audio components for capturing and streaming
     */
    async initializeAudio() {
        try {
            // Skip audio initialization for OpenAI model
            if (this.modelType === 'openai') {
                console.log('Skipping audio initialization for OpenAI model');
                return Promise.resolve();
            }

            console.log('Initializing audio components...');
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Set up audio recorder for user's speech
            this.audioRecorder = new AudioRecorder({
                onAudioDataAvailable: this.handleCapturedAudio.bind(this),
                sendToUserTranscriber: this.transcribeUsersSpeech
            });
            
            // Create audio streamer for model's speech
            this.audioStreamer = new AudioStreamer(this.audioContext, this.modelSampleRate);
            
            // Create transcriber for user speech if requested
            if (this.transcribeUsersSpeech) {
                this.userTranscriber = new DeepgramTranscriber({
                    apiKey: this.deepgramApiKey,
                    onTranscript: (text) => {
                        this.emit('user_transcription', text);
                    }
                });
            }
            
            // Create transcriber for model speech if requested
            if (this.transcribeModelsSpeech) {
                this.modelTranscriber = new DeepgramTranscriber({
                    apiKey: this.deepgramApiKey,
                    onTranscript: (text) => {
                        this.emit('transcription', text);
                    }
                });
            }
            
            console.log("Audio components initialized");
        } catch (error) {
            console.error("Error initializing audio:", error);
            throw error;
        }
    }

    /**
     * Starts camera capture and sends images at regular intervals
     */
    async startCameraCapture() {
        // For OpenAI model, camera input is only stored locally, not streamed continuously
        if (this.modelType === 'openai') {
            console.warn('Continuous camera streaming is not used with OpenAI model');
            
            try {
                await this.cameraManager.initialize();
                console.info('Camera initialized for OpenAI (single captures only)');
            } catch (error) {
                console.error('Failed to initialize camera for OpenAI:', error);
                throw error;
            }
            return;
        }
        
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
                this.model.sendImage(imageBase64);                
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
        // For OpenAI model, screen sharing is only stored locally, not streamed continuously
        if (this.modelType === 'openai') {
            console.warn('Continuous screen sharing is not used with OpenAI model');
            return;
        }
        
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
                this.model.sendImage(imageBase64);
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
            if (this.model) {
                await this.model.disconnect();
            }
            
            this.initialized = false;
            this.connected = false;
            
            console.info('Disconnected and cleaned up all resources');
        } catch (error) {
            throw new Error('Disconnect error:' + error);
        }
    }

    /**
     * Toggles the microphone on/off
     */
    async toggleMic() {
        // For OpenAI model, microphone input is not supported
        if (this.modelType === 'openai') {
            console.warn('Microphone input is not supported with OpenAI model');
            return;
        }
        
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
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
            if (!this.audioRecorder.isSuspended && (!this.model.ws || this.model.ws.readyState !== WebSocket.OPEN)) {
                console.info("WebSocket not in OPEN state after resuming mic. Attempting to reconnect...");
                await this.model.connect();
            }
        } catch (error) {
            console.error("Error in toggleMic:", error);
            // Try to recover the WebSocket connection if it failed
            if (this.model && (!this.model.ws || this.model.ws.readyState !== WebSocket.OPEN)) {
                try {
                    console.info("Attempting to reconnect WebSocket after error...");
                    await this.model.connect();
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

    /**
     * Initializes the agent based on the selected model type
     */
    async initialize() {
        try {
            console.log(`Initializing agent with ${this.modelType} model...`);
            
            if (this.modelType === 'openai') {
                // For OpenAI, we only need basic initialization without audio components
                this.initialized = true;
                console.info('OpenAI agent initialized successfully');
                return;
            }
            
            // For Gemini, initialize audio components for real-time streaming
            await this.initializeAudio();
            
            this.initialized = true;
            console.info(`${this.modelType} agent initialized successfully`);
            
            // Optional: trigger the model to start speaking first
            await this.model.sendText('.');
        } catch (error) {
            console.error('Initialization error:', error);
            throw new Error('Error during the initialization of the agent: ' + error.message);
        }
    }
}