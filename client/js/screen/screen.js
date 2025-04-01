/**
 * Manages screen sharing capture and image processing
 */
export class ScreenManager {
    /**
     * @param {Object} config
     * @param {number} config.width - Target width for resizing captured images
     * @param {number} config.quality - JPEG quality (0-1)
     * @param {Function} [config.onStop] - Callback when screen sharing stops
     * @param {boolean} [config.showSelectionDialog] - Whether to show the selection dialog when initializing
     */
    constructor(config) {
        this.config = {
            width: config.width || 1280,
            quality: config.quality || 0.8,
            onStop: config.onStop,
            showSelectionDialog: config.showSelectionDialog || false
        };
        
        this.stream = null;
        this.videoElement = null;
        this.canvas = null;
        this.ctx = null;
        this.isInitialized = false;
        this.aspectRatio = null;
        this.previewContainer = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isMinimized = false;
        this.selectedSourceId = null;
        this.sources = [];
        this.selectionCallback = null;
    }

    /**
     * Show the screen preview
     */
    showPreview() {
        if (this.previewContainer) {
            this.previewContainer.style.display = 'block';
            this._setupDragAndMinimize();
        }
    }

    /**
     * Hide the screen preview
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
        let header = this.previewContainer.querySelector('.screen-preview-header');
        if (!header) {
            header = document.createElement('div');
            header.className = 'screen-preview-header';
            header.innerHTML = `
                <span class="screen-preview-title">Screen Share</span>
                <div class="screen-preview-controls">
                    <button class="screen-preview-btn source-select-btn" title="Change Source">📺</button>
                    <button class="screen-preview-btn minimize-btn" title="Minimize">_</button>
                </div>
            `;
            this.previewContainer.insertBefore(header, this.previewContainer.firstChild);

            // Add minimize button click handler
            const minimizeBtn = header.querySelector('.minimize-btn');
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMinimize();
            });

            // Add source selection button click handler
            const sourceSelectBtn = header.querySelector('.source-select-btn');
            sourceSelectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showSourceSelectionDialog();
            });
        }

        // Setup drag functionality
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.screen-preview-controls')) return;
            
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
     * Shows the source selection dialog
     * @returns {Promise<string>} Source ID selected by user
     */
    async showSourceSelectionDialog() {
        // Get available screen sources
        try {
            this.sources = await window.api.getScreenSources();
            
            // Create dialog overlay
            const overlay = document.createElement('div');
            overlay.className = 'source-selection-overlay';
            
            // Create dialog
            const dialog = document.createElement('div');
            dialog.className = 'source-selection-dialog';
            dialog.innerHTML = `
                <h3>Select Screen or Window to Share</h3>
                <div class="source-selection-container"></div>
                <div class="source-selection-buttons">
                    <button class="cancel-btn">Cancel</button>
                </div>
            `;
            
            // Add sources to the container as a simple list without thumbnails
            const container = dialog.querySelector('.source-selection-container');
            this.sources.forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'source-item';
                sourceItem.dataset.id = source.id;
                
                sourceItem.innerHTML = `
                    <div class="source-name">${source.name}</div>
                `;
                
                // Select source on click
                sourceItem.addEventListener('click', () => {
                    this.selectedSourceId = source.id;
                    
                    // Remove any existing selection
                    const selected = container.querySelector('.source-item.selected');
                    if (selected) selected.classList.remove('selected');
                    
                    // Mark this item as selected
                    sourceItem.classList.add('selected');
                    
                    // Enable the select button
                    const selectBtn = dialog.querySelector('.select-btn');
                    if (selectBtn) selectBtn.disabled = false;
                });
                
                container.appendChild(sourceItem);
            });
            
            // Add select button only if we have sources
            if (this.sources.length > 0) {
                const buttonsContainer = dialog.querySelector('.source-selection-buttons');
                const selectBtn = document.createElement('button');
                selectBtn.className = 'select-btn';
                selectBtn.textContent = 'Select';
                selectBtn.disabled = true; // Disabled until a source is selected
                
                selectBtn.addEventListener('click', () => {
                    if (this.selectedSourceId) {
                        document.body.removeChild(overlay);
                        
                        // Execute the callback with the selected source ID
                        if (this.selectionCallback) {
                            this.selectionCallback(this.selectedSourceId);
                            this.selectionCallback = null;
                        }
                    }
                });
                
                buttonsContainer.appendChild(selectBtn);
            }
            
            // Add cancel button handler
            const cancelBtn = dialog.querySelector('.cancel-btn');
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                
                // Execute the callback with null to indicate cancellation
                if (this.selectionCallback) {
                    this.selectionCallback(null);
                    this.selectionCallback = null;
                }
            });
            
            // Add dialog to overlay and overlay to body
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            // Return a promise that resolves when a source is selected
            return new Promise(resolve => {
                this.selectionCallback = resolve;
            });
        } catch (error) {
            console.error('Failed to show source selection dialog:', error);
            return null;
        }
    }
    
    /**
     * Change the screen source being shared
     * @param {string} sourceId The ID of the source to share
     * @returns {Promise<boolean>} Whether the source change was successful
     */
    async changeSource(sourceId) {
        if (!sourceId) return false;
        
        try {
            // If already initialized, dispose of current stream
            if (this.isInitialized) {
                await this.dispose();
            }
            
            // Store the selected source ID
            this.selectedSourceId = sourceId;
            
            // Initialize with the selected source
            await this.initialize(sourceId);
            return true;
        } catch (error) {
            console.error('Failed to change screen source:', error);
            return false;
        }
    }

    /**
     * Initialize screen capture stream and canvas
     * @param {string} [sourceId] Optional source ID to capture. If not provided, will use the first source or show selection dialog.
     * @returns {Promise<void>}
     */
    async initialize(sourceId) {
        if (this.isInitialized) return;

        try {
            // Get available screen sources using native desktopCapturer
            this.sources = await window.api.getScreenSources();
            
            if (!this.sources || this.sources.length === 0) {
                throw new Error('No screen sources available');
            }
            
            // Use provided source ID, previously selected ID, or prompt user to select
            let selectedId = sourceId || this.selectedSourceId;
            
            // If we don't have a source ID yet, either use the first source or show selection dialog
            if (!selectedId) {
                // Default to the first source if available
                if (this.config.showSelectionDialog) {
                    selectedId = await this.showSourceSelectionDialog();
                    
                    // If selection was cancelled, throw an error
                    if (!selectedId) {
                        throw new Error('Screen sharing cancelled by user');
                    }
                } else {
                    selectedId = this.sources[0].id;
                }
            }
            
            // Save the selected source ID
            this.selectedSourceId = selectedId;
            
            // Find the selected source to use
            const source = this.sources.find(s => s.id === selectedId);
            if (!source) {
                throw new Error('Selected screen source not found');
            }

            // Request screen sharing using the source ID
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: source.id,
                        minWidth: 1280,
                        maxWidth: 4096,
                        minHeight: 720,
                        maxHeight: 2160
                    }
                }
            });

            // Create and setup video element
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = this.stream;
            this.videoElement.playsInline = true;

            // Add video to preview container
            const previewContainer = document.getElementById('screenPreview');
            if (previewContainer) {
                previewContainer.innerHTML = ''; // Clear any existing content
                previewContainer.appendChild(this.videoElement);
                this.previewContainer = previewContainer;
                this.showPreview(); // Show preview when initialized
            }

            await this.videoElement.play();

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

            // Listen for the end of screen sharing
            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                this.dispose();
                // Notify parent component that sharing has stopped
                if (this.config.onStop) {
                    this.config.onStop();
                }
            });

            this.isInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize screen capture: ${error.message}`);
        }
    }

    /**
     * Get current canvas dimensions
     * @returns {{width: number, height: number}}
     */
    getDimensions() {
        if (!this.isInitialized) {
            throw new Error('Screen capture not initialized. Call initialize() first.');
        }
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }

    /**
     * Capture and process a screenshot
     * @returns {Promise<string>} Base64 encoded JPEG image
     */
    async capture() {
        if (!this.isInitialized) {
            throw new Error('Screen capture not initialized. Call initialize() first.');
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
     * Stop screen capture and cleanup resources
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
}
