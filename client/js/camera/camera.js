/**
 * Manages camera access, capture, and image processing
 */
export class CameraManager {
    /**
     * @param {Object} config
     * @param {number} config.width - Target width for resizing captured images
     * @param {number} config.quality - JPEG quality (0-1)
     * @param {string} [config.facingMode] - Camera facing mode (optional, mobile-only)
     */
    constructor(config) {
        this.config = {
            width: config.width || 640,
            quality: config.quality || 0.8,
            facingMode: config.facingMode // undefined by default for desktop compatibility
        };
        
        this.stream = null;
        this.videoElement = null;
        this.canvas = null;
        this.ctx = null;
        this.isInitialized = false;
        this.aspectRatio = null;
        this.previewContainer = null;
        this.switchButton = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isMinimized = false;
    }

    /**
     * Show the camera preview
     */
    showPreview() {
        if (this.previewContainer) {
            this.previewContainer.style.display = 'block';
            this._setupDragAndMinimize();
        }
    }

    /**
     * Hide the camera preview
     */
    hidePreview() {
        if (this.previewContainer) {
            this.previewContainer.style.display = 'none';
        }
    }

    /**
     * Toggle minimize state of the preview
     */
    toggleMinimize() {
        if (this.previewContainer) {
            this.isMinimized = !this.isMinimized;
            this.previewContainer.classList.toggle('minimized', this.isMinimized);
        }
    }

    /**
     * Setup drag and minimize functionality
     * @private
     */
    _setupDragAndMinimize() {
        if (!this.previewContainer) return;

        // Create header if it doesn't exist
        let header = this.previewContainer.querySelector('.camera-preview-header');
        if (!header) {
            header = document.createElement('div');
            header.className = 'camera-preview-header';
            header.innerHTML = `
                <span class="camera-preview-title">Camera</span>
                <div class="camera-preview-controls">
                    <button class="camera-preview-btn minimize-btn">_</button>
                </div>
            `;
            this.previewContainer.insertBefore(header, this.previewContainer.firstChild);

            // Add minimize button click handler
            const minimizeBtn = header.querySelector('.minimize-btn');
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMinimize();
            });
        }

        // Setup drag functionality
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.camera-preview-controls')) return;
            
            this.isDragging = true;
            const rect = this.previewContainer.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;

            // Keep the preview within window bounds
            const rect = this.previewContainer.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;

            this.previewContainer.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
            this.previewContainer.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
    }

    /**
     * Create and append the camera switch button
     * @private
     */
    _createSwitchButton() {
        // Only create button on mobile devices
        if (!/Mobi|Android/i.test(navigator.userAgent)) return;

        this.switchButton = document.createElement('button');
        this.switchButton.className = 'camera-switch-btn';
        this.switchButton.innerHTML = '⟲';
        this.switchButton.addEventListener('click', () => this.switchCamera());
        this.previewContainer.appendChild(this.switchButton);
    }

    /**
     * Initialize camera stream and canvas
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Get preferred camera device ID from localStorage
            const videoDeviceId = localStorage.getItem('selectedVideoDeviceId');
            
            // Build constraints based on platform and selected device
            const constraints = {
                video: {
                    width: { ideal: 1920 }, // Request max quality first
                    height: { ideal: 1080 }
                }
            };

            // Set initial facingMode on mobile
            if (/Mobi|Android/i.test(navigator.userAgent)) {
                this.config.facingMode = this.config.facingMode || 'user'; // Default to front camera
                constraints.video.facingMode = this.config.facingMode;
            } 
            // Set deviceId constraint for desktop or when specific device is selected
            else if (videoDeviceId && videoDeviceId !== 'default') {
                try {
                    // Try to initialize with the exact device first
                    constraints.video.deviceId = { exact: videoDeviceId };
                    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (deviceError) {
                    console.warn('Selected camera device is unavailable:', deviceError.message);
                    
                    // If that fails, fall back to any available camera
                    delete constraints.video.deviceId;
                    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                    
                    // Get device info to update localStorage with the new device
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const availableCameras = devices.filter(device => device.kind === 'videoinput');
                    
                    if (availableCameras.length > 0) {
                        // Update localStorage to the first available camera
                        localStorage.setItem('selectedVideoDeviceId', availableCameras[0].deviceId);
                        console.info('Camera fallback: now using', availableCameras[0].label);
                    } else {
                        localStorage.setItem('selectedVideoDeviceId', 'default');
                    }
                }
            } else {
                // Default case - use whatever camera is available
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            }

            // If we don't have a stream yet (only happens if we didn't enter the deviceId error handling block)
            if (!this.stream) {
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            }

            // Create and setup video element
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = this.stream;
            this.videoElement.playsInline = true;
            
            // Add video to preview container
            const previewContainer = document.getElementById('cameraPreview');
            if (previewContainer) {
                previewContainer.innerHTML = ''; // Clear any existing content
                previewContainer.appendChild(this.videoElement);
                this.previewContainer = previewContainer;
                this._createSwitchButton(); // Add switch button
                this.showPreview(); // Show preview when initialized
            }
            
            await this.videoElement.play();
            
            // Log which camera is being used
            const videoTrack = this.stream.getVideoTracks()[0];
            console.info('Camera initialized with device:', videoTrack.label);

            // Get the actual video dimensions
            const videoWidth = this.videoElement.videoWidth;
            const videoHeight = this.videoElement.videoHeight;
            this.aspectRatio = videoHeight / videoWidth;

            // Calculate canvas size maintaining aspect ratio
            const canvasWidth = this.config.width;
            const canvasHeight = Math.round(this.config.width * this.aspectRatio);

            // Create canvas for image processing
            this.canvas = document.createElement('canvas');
            this.canvas.width = canvasWidth;
            this.canvas.height = canvasHeight;
            this.ctx = this.canvas.getContext('2d');

            this.isInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize camera: ${error.message}`);
        }
    }

    /**
     * Get current canvas dimensions
     * @returns {{width: number, height: number}}
     */
    getDimensions() {
        if (!this.isInitialized) {
            throw new Error('Camera not initialized. Call initialize() first.');
        }
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }

    /**
     * Capture and process an image from the camera
     * @returns {Promise<string>} Base64 encoded JPEG image
     */
    async capture() {
        if (!this.isInitialized) {
            throw new Error('Camera not initialized. Call initialize() first.');
        }

        // Draw current video frame to canvas, maintaining aspect ratio
        this.ctx.drawImage(
            this.videoElement,
            0, 0,
            this.canvas.width,
            this.canvas.height
        );

        // Convert to base64 JPEG with specified quality
        return this.canvas.toDataURL('image/jpeg', this.config.quality).split(',')[1];
    }

    /**
     * Stop camera stream and cleanup resources
     */
    dispose() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.videoElement) {
            this.videoElement.srcObject = null;
            this.videoElement = null;
        }

        if (this.switchButton) {
            this.switchButton.remove();
            this.switchButton = null;
        }

        if (this.previewContainer) {
            this.hidePreview();
            this.previewContainer.innerHTML = ''; // Clear the preview container
            this.previewContainer = null;
        }

        this.canvas = null;
        this.ctx = null;
        this.isInitialized = false;
        this.aspectRatio = null;
    }

    /**
     * Switch between front and back cameras on mobile or between different cameras on desktop
     */
    async switchCamera() {
        if (!this.isInitialized) return;
        
        // Get current video track and stop it
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        try {
            let constraints = { video: {} };
            
            // Mobile device switching logic - toggle between front/back
            if (/Mobi|Android/i.test(navigator.userAgent)) {
                // Toggle facingMode
                this.config.facingMode = this.config.facingMode === 'user' ? 'environment' : 'user';
                localStorage.setItem('facingMode', this.config.facingMode);
                
                constraints.video = {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: this.config.facingMode
                };
            } 
            // Desktop switching logic - get next available camera
            else {
                // Get all video devices
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                
                if (videoDevices.length <= 1) {
                    console.warn("No alternative camera found");
                    return;
                }
                
                // Get current device ID from the active track or localStorage
                const currentDeviceId = this.stream?.getVideoTracks()[0]?.getSettings()?.deviceId || 
                                        localStorage.getItem('selectedVideoDeviceId');
                
                // Find the index of the current device
                const currentIndex = videoDevices.findIndex(device => device.deviceId === currentDeviceId);
                
                // Get the next device in the list, or go back to the first one
                const nextIndex = (currentIndex + 1) % videoDevices.length;
                const nextDevice = videoDevices[nextIndex];
                
                // Save the new device ID
                localStorage.setItem('selectedVideoDeviceId', nextDevice.deviceId);
                
                constraints.video = {
                    deviceId: { exact: nextDevice.deviceId },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                };
            }

            // Get new stream with the new constraints
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();
            
            // Log the camera switch
            const videoTrack = this.stream.getVideoTracks()[0];
            console.info('Switched camera to:', videoTrack.label);
            
        } catch (error) {
            console.error('Failed to switch camera:', error);
            // Revert to previous setting on error
            if (/Mobi|Android/i.test(navigator.userAgent)) {
                this.config.facingMode = localStorage.getItem('facingMode') || 'environment';
            }
        }
    }
}
