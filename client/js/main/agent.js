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

        // Initialize event emitter
        this._eventListeners = new Map();

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
        
        // Initialize capture settings
        this.fps = parseInt(localStorage.getItem('fps')) || 5;
        this.captureInterval = 1000 / this.fps;
        this.resizeWidth = parseInt(localStorage.getItem('resizeWidth')) || 640;
        this.quality = parseFloat(localStorage.getItem('quality')) || 0.4;
        
        // For camera and screen capture
        this.cameraManager = null;
        this.screenManager = null;
        
        // Store configuration
        this.config = config;
        this.modelType = modelType;
        this.modelSampleRate = modelSampleRate;
        this.name = name;
        
        // Create model instance
        this.model = ModelFactory.createModel(modelType, config, {
            geminiApiKey,
            openaiApiKey
        });

        // Bind methods that will be used as callbacks
        this.handleCapturedAudio = this.handleCapturedAudio.bind(this);
        
        // Set up tool manager if provided
        this.toolManager = toolManager;
    }

    /**
     * Connects to the model's backend service
     */
    async connect() {
        try {
            console.log('Connecting to gemini model...');
            // Set up event listeners if not already done
            if (!this._eventListeners) {
                this.setupModelEventListeners();
            }
            await this.model.connect();
            this.connected = true;
        } catch (error) {
            console.error('Error connecting to gemini model:', error);
            throw error;
        }
    }

    /**
     * Initializes the agent's components (audio, camera, screen)
     * This should only be called when explicitly starting a media feature
     */
    async initializeMedia() {
        if (this.initialized) {
            return;
        }

        try {
            // Initialize audio components
            this.audioRecorder = new AudioRecorder();
            const boundAudioHandler = this.handleCapturedAudio.bind(this);
            this.audioRecorder.onAudioData = boundAudioHandler;
            
            if (this.deepgramApiKey && this.transcribeUsersSpeech) {
                this.userTranscriber = new DeepgramTranscriber(this.deepgramApiKey);
            }
            
            // Initialize camera manager
            this.cameraManager = new CameraManager({
                width: this.resizeWidth,
                quality: this.quality
            });
            
            // Initialize screen manager
            this.screenManager = new ScreenManager({
                width: this.resizeWidth,
                quality: this.quality,
                fps: this.fps
            });
            
            // Setup model transcriber if needed
            if (this.deepgramApiKey && this.transcribeModelsSpeech) {
                this.modelTranscriber = new DeepgramTranscriber(this.deepgramApiKey);
                this.model.on('audio', (audioData) => {
                    if (this.modelTranscriber) {
                        this.modelTranscriber.transcribe(audioData);
                    }
                });
            }
            
            this.initialized = true;
            console.info('Media components initialized');
        } catch (error) {
            console.error('Error initializing media components:', error);
            throw error;
        }
    }

    setupModelEventListeners() {
        if (!this._eventListeners) {
            this._eventListeners = new Map();
        }
        
        console.log(`Setting up event listeners for ${this.modelType} model`);
        
        // Handle incoming text from the model
        this.model.on('text', (text) => {
            this.emit('text', text);
        });
        
        // Handle model connection events
        this.model.on('connected', () => {
            this.connected = true;
            this.emit('connected');
        });
        
        this.model.on('disconnected', () => {
            this.connected = false;
            this.emit('disconnected');
        });
        
        // Handle model errors
        this.model.on('error', (error) => {
            console.error('Model error:', error);
            this.emit('error', error);
        });
        
        // Handle content events (for Gemini model)
        this.model.on('content', (content) => {
            this.emit('content', content);
        });
        
        // Handle audio events (for Gemini model)
        this.model.on('audio', (audio) => {
            this.emit('audio', audio);
        });
        
        // Handle turn completion
        this.model.on('turn_complete', () => {
            console.info('Model turn complete');
            this.emit('turn_complete');
            
            // Disconnect the model transcriber when audio is complete to save resources
            if (this.modelTranscriber && this.modelTranscriber.isConnected) {
                console.log("Disconnecting model transcriber after turn completion");
                this.modelTranscriber.disconnect();
            }
        });

        // Handle interruption
        this.model.on('interrupted', () => {
            console.info('Model interrupted');
            this.emit('interrupted');
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
     * Sends a text message to the model.
     * @param {string} text - The text message to send.
     */
    async sendText(text) {
        console.log(`Sending text to ${this.modelType} model:`, text);
        // First emit text_sent to ensure UI shows user message
        this.emit('text_sent', text);
        // Then send to model
        await this.model.sendText(text);
    }

    /**
     * Starts camera capture
     */
    async startCameraCapture() {
        await this.initializeMedia();
        if (!this.cameraManager) {
            throw new Error('Camera manager not initialized');
        }
        
        // Define the capture callback to send images to the model
        const captureCallback = async (base64Image) => {
            if (this.model && this.connected) {
                try {
                    await this.model.sendImage(base64Image);
                    console.debug('Camera image sent to model');
                } catch (error) {
                    console.error('Error sending camera image to model:', error);
                }
            }
        };
        
        // Start the camera with the capture callback
        await this.cameraManager.start(captureCallback);
        this.emit('camera_started');
    }

    /**
     * Stops camera capture
     */
    async stopCameraCapture() {
        if (this.cameraManager) {
            await this.cameraManager.stop();
            this.emit('camera_stopped');
        }
    }

    /**
     * Starts screen sharing
     */
    async startScreenShare(showSelectionDialog = false) {
        await this.initializeMedia();
        if (!this.screenManager) {
            throw new Error('Screen manager not initialized');
        }
        
        // Define the capture callback to send images to the model
        const captureCallback = async (base64Image) => {
            if (this.model && this.connected) {
                try {
                    await this.model.sendImage(base64Image);
                    console.debug('Screen image sent to model');
                } catch (error) {
                    console.error('Error sending screen image to model:', error);
                }
            }
        };
        
        // Start screen sharing with the capture callback
        await this.screenManager.start(showSelectionDialog, captureCallback);
        this.emit('screenshare_started');
    }

    /**
     * Stops screen sharing
     */
    async stopScreenShare() {
        if (this.screenManager) {
            await this.screenManager.stop();
            this.emit('screenshare_stopped');
        }
    }

    /**
     * Toggles microphone
     */
    async toggleMic() {
        await this.initializeMedia();
        if (!this.audioRecorder) {
            throw new Error('Audio recorder not initialized');
        }
        
        if (this.audioRecorder.isRecording) {
            await this.audioRecorder.stop();
            this.emit('mic_stopped');
        } else {
            // Start with the callback to handle captured audio
            await this.audioRecorder.start(this.handleCapturedAudio.bind(this));
            this.emit('mic_started');
        }
    }

    /**
     * Stops audio capture
     */
    async stopAudioCapture() {
        if (this.audioRecorder) {
            await this.audioRecorder.stop();
            this.emit('mic_stopped');
        }
    }

    /**
     * Handle captured audio data from the microphone
     * @param {string} audioData - The base64 encoded audio data
     */
    async handleCapturedAudio(audioData) {
        if (!this.model || !this.connected) {
            console.warn('Cannot handle audio: model not connected');
            return;
        }
        
        try {
            // audioData is already base64 encoded from the AudioRecorder
            await this.model.sendAudio(audioData);
        } catch (error) {
            console.error('Error sending audio data:', error);
            this.emit('error', error);
        }
    }

    /**
     * Gracefully terminates all active connections and streams.
     * Ensures proper cleanup of audio, screen sharing, and WebSocket resources.
     */
    async disconnect() {
        try {
            // Stop camera capture first
            if (this.cameraManager) {
                await this.cameraManager.stop();
            }

            // Stop screen sharing
            if (this.screenManager) {
                await this.screenManager.stop();
            }

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