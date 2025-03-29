import { arrayBufferToBase64 } from '../utils/utils.js';

/**
 * AudioRecorder manages the capture and processing of audio input from the user's microphone.
 * It uses the Web Audio API and AudioWorklet to process audio in real-time with minimal latency.
 * The processed audio is converted to base64-encoded Int16 format suitable for transmission.
 */
export class AudioRecorder extends EventTarget {
    /**
     * Creates an AudioRecorder instance
     */
    constructor() {
        super();
        // Core audio configuration
        this.sampleRate = 16000;         // Sample rate in Hz   
        this.stream = null;              // MediaStream from getUserMedia
        this.audioContext = null;        // AudioContext for Web Audio API
        this.source = null;              // MediaStreamAudioSourceNode
        this.processor = null;           // AudioWorkletNode for processing
        this.onAudioData = null;         // Callback for processed audio chunks
        this.isRecording = false;        // Recording state flag
        this.isSuspended = false;        // Mic suspension state
    }

    /**
     * Initializes and starts audio capture pipeline
     * Sets up audio context, worklet processor, and media stream
     * @param {Function} onAudioData - Callback receiving base64-encoded audio chunks
     */
    async start(onAudioData) {
        this.onAudioData = onAudioData;
        try {
            // Get preferred microphone device ID from localStorage
            const audioDeviceId = localStorage.getItem('selectedAudioDeviceId');
            
            // Configure audio constraints based on device selection
            const audioConstraints = {
                channelCount: 1,
                sampleRate: this.sampleRate,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            
            // Add deviceId constraint if a specific device was selected
            if (audioDeviceId && audioDeviceId !== 'default') {
                audioConstraints.deviceId = { exact: audioDeviceId };
            }
            
            // Request microphone access with specific configuration
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: audioConstraints
            });
            
            // Initialize Web Audio API context and nodes
            this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
            this.source = this.audioContext.createMediaStreamSource(this.stream);

            // Load and initialize audio processing worklet
            await this.audioContext.audioWorklet.addModule('js/audio/worklets/audio-processor.js');
            this.processor = new AudioWorkletNode(this.audioContext, 'audio-recorder-worklet');
            
            // Handle processed audio chunks from worklet
            this.processor.port.onmessage = (event) => {
                if (!this.isRecording) return;
                
                if (event.data.event === 'chunk' && this.onAudioData) {
                    const base64Data = arrayBufferToBase64(event.data.data.int16arrayBuffer);
                    this.onAudioData(base64Data);
                }
            };

            // Connect audio processing pipeline
            this.source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            this.isRecording = true;
            
            // Log which device was used
            const audioTrack = this.stream.getAudioTracks()[0];
            console.info('Audio recording started with device:', audioTrack.label);
        } catch (error) {
            throw new Error('Failed to start audio recording:' + error);
        }
    }

    /**
     * Gracefully stops audio recording and cleans up resources
     * Stops media tracks and logs the operation completion
     */
    stop() {
        try {
            if (!this.isRecording) {
                return;
            }

            // Stop all active media tracks
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            this.isRecording = false;
            console.info('Audio recording stopped');

            if (this.audioContext) {
                this.audioContext.close();
            }
        } catch (error) {
            throw new Error('Failed to stop audio recording:' + error);
        }
    }

    /**
     * Suspends microphone input without destroying the audio context
     */
    async suspendMic() {
        if (!this.isRecording || this.isSuspended) return;
        
        try {
            await this.audioContext.suspend();
            this.stream.getTracks().forEach(track => track.enabled = false);
            this.isSuspended = true;
            console.info('Microphone suspended');
        } catch (error) {
            throw new Error('Failed to suspend microphone:' + error);
        }
    }

    /**
     * Resumes microphone input if previously suspended
     */
    async resumeMic() {
        if (!this.isRecording || !this.isSuspended) return;
        
        try {
            await this.audioContext.resume();
            this.stream.getTracks().forEach(track => track.enabled = true);
            this.isSuspended = false;
            console.info('Microphone resumed');
        } catch (error) {
            throw new Error('Failed to resume microphone:' + error);
        }
    }

    /**
     * Toggles microphone state between suspended and active
     */
    async toggleMic() {
        try {
            if (this.isSuspended) {
                await this.resumeMic();
            } else {
                await this.suspendMic();
            }
        } catch (error) {
            console.error("Error toggling microphone:", error);
            // Try to recover by resetting microphone state
            this.isSuspended = false;
            // Attempt to restart if we're in a bad state
            if (this.stream) {
                this.stream.getTracks().forEach(track => {
                    track.enabled = true;
                    if (track.readyState !== "live") {
                        console.warn("Audio track not in 'live' state, attempting to recover");
                    }
                });
            }
            try {
                if (this.audioContext && this.audioContext.state !== "running") {
                    await this.audioContext.resume();
                }
            } catch (e) {
                console.error("Failed to resume audio context:", e);
            }
            throw new Error(`Microphone toggle failed: ${error.message}`);
        }
    }
}