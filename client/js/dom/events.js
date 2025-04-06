import elements from './elements.js';
import settingsManager from '../settings/settings-manager.js';

/**
 * Updates UI to show disconnect button and hide connect button
 */
const showDisconnectButton = () => {
    elements.connectBtn.style.display = 'none';
    elements.disconnectBtn.style.display = 'block';
};

/**
 * Updates UI to show connect button and hide disconnect button
 */
const showConnectButton = () => {
    elements.disconnectBtn.style.display = 'none';
    elements.connectBtn.style.display = 'block';
};

let isCameraActive = false;

/**
 * Ensures the agent is connected and initialized
 * @param {GeminiAgent} agent - The main application agent instance
 * @returns {Promise<void>}
 */
const ensureAgentReady = async (agent) => {
    if (!agent.connected) {
        await agent.connect();
        showDisconnectButton();
    }
    if (!agent.initialized) {
        await agent.initialize();
    }
};

/**
 * Sets up event listeners for the application's UI elements
 * @param {GeminiAgent} agent - The main application agent instance
 */
export function setupEventListeners(agent) {
    // Disconnect handler
    elements.disconnectBtn.addEventListener('click', async () => {
        try {
            await agent.disconnect();
            showConnectButton();
            [elements.cameraBtn, elements.screenBtn, elements.micBtn].forEach(btn => btn.classList.remove('active'));
            isCameraActive = false;
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    });

    // Connect handler
    elements.connectBtn.addEventListener('click', async () => {
        try {
            await ensureAgentReady(agent);
        } catch (error) {
            console.error('Error connecting:', error);
        }
    });

    // Microphone toggle handler
    elements.micBtn.addEventListener('click', async () => {
        try {
            console.log("Microphone button clicked, ensuring agent is ready...");
            await ensureAgentReady(agent);
            console.log("Agent ready, toggling microphone...");
            
            // Check WebSocket state before toggling
            if (agent.client && agent.client.ws) {
                console.log("WebSocket readyState before toggle:", agent.client.ws.readyState);
            }
            
            await agent.toggleMic();
            elements.micBtn.classList.toggle('active');
            
            console.log("Microphone toggled successfully, state:", 
                agent.audioRecorder?.isSuspended ? "suspended" : "active");
                
            // Check WebSocket state after toggling
            if (agent.client && agent.client.ws) {
                console.log("WebSocket readyState after toggle:", agent.client.ws.readyState);
            }
        } catch (error) {
            console.error('Error toggling microphone:', error);
            elements.micBtn.classList.remove('active');
        }
    });

    // Camera toggle handler
    elements.cameraBtn.addEventListener('click', async () => {
        try {
            await ensureAgentReady(agent);
            
            if (!isCameraActive) {
                await agent.startCameraCapture();
                elements.cameraBtn.classList.add('active');
            } else {
                await agent.stopCameraCapture();
                elements.cameraBtn.classList.remove('active');
            }
            isCameraActive = !isCameraActive;
        } catch (error) {
            console.error('Error toggling camera:', error);
            elements.cameraBtn.classList.remove('active');
            isCameraActive = false;
        }
    });

    // Screen sharing handler
    let isScreenShareActive = false;
    
    // Create a context menu for the screen button
    const createScreenContextMenu = (button) => {
        // Create context menu element if it doesn't exist
        let contextMenu = document.getElementById('screenContextMenu');
        if (!contextMenu) {
            contextMenu = document.createElement('div');
            contextMenu.id = 'screenContextMenu';
            contextMenu.className = 'context-menu';
            contextMenu.innerHTML = `
                <div class="context-menu-item" data-action="share-default">Share Screen (Default)</div>
                <div class="context-menu-item" data-action="select-source">Select Screen or Window...</div>
            `;
            document.body.appendChild(contextMenu);
            
            // Add click handlers for menu items
            contextMenu.addEventListener('click', async (e) => {
                const action = e.target.dataset.action;
                if (!action) return;
                
                hideContextMenu();
                
                try {
                    await ensureAgentReady(agent);
                    
                    if (action === 'share-default') {
                        if (!isScreenShareActive) {
                            await agent.startScreenShare(false); // Use default (first) source
                            elements.screenBtn.classList.add('active');
                            isScreenShareActive = true;
                        }
                    } else if (action === 'select-source') {
                        if (!isScreenShareActive) {
                            await agent.startScreenShare(true); // Show selection dialog
                            elements.screenBtn.classList.add('active');
                            isScreenShareActive = true;
                        }
                    }
                } catch (error) {
                    console.error('Error in screen share action:', error);
                    elements.screenBtn.classList.remove('active');
                    isScreenShareActive = false;
                }
            });
        }
        
        return contextMenu;
    };

    const showContextMenu = (event, contextMenu) => {
        // Position the menu near the click
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.display = 'block';
        
        // Prevent default right-click menu
        event.preventDefault();
        
        // Hide menu when clicking outside
        const hideOnClickOutside = (e) => {
            if (!contextMenu.contains(e.target) && e.target !== event.target) {
                hideContextMenu();
                document.removeEventListener('click', hideOnClickOutside);
            }
        };
        
        // Add a small delay before adding the event listener to prevent immediate hiding
        setTimeout(() => {
            document.addEventListener('click', hideOnClickOutside);
        }, 10);
    };

    const hideContextMenu = () => {
        const contextMenu = document.getElementById('screenContextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    };

    // Listen for screen share stopped events (from native browser controls)
    agent.on('screenshare_stopped', () => {
        elements.screenBtn.classList.remove('active');
        isScreenShareActive = false;
        console.info('Screen share stopped');
    });

    // Left-click handler for screen button
    elements.screenBtn.addEventListener('click', async () => {
        try {
            // If screen sharing is active, stop it
            if (isScreenShareActive) {
                await agent.stopScreenShare();
                elements.screenBtn.classList.remove('active');
                isScreenShareActive = false;
            } else {
                // On left-click, check if settings say to show selection dialog
                const showSelectionDialog = localStorage.getItem('showScreenSelectionDialog') === 'true';
                
                await ensureAgentReady(agent);
                await agent.startScreenShare(showSelectionDialog);
                elements.screenBtn.classList.add('active');
                isScreenShareActive = true;
            }
        } catch (error) {
            console.error('Error toggling screen share:', error);
            elements.screenBtn.classList.remove('active');
            isScreenShareActive = false;
        }
    });
    
    // Right-click handler for screen button (the context menu)
    elements.screenBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Only show context menu if not already sharing screen
        if (!isScreenShareActive) {
            showContextMenu(e, createScreenContextMenu(elements.screenBtn));
        }
    });

    // Message sending handlers
    const sendMessage = async () => {
        try {
            await ensureAgentReady(agent);
            const text = elements.messageInput.value.trim();
            await agent.sendText(text);
            elements.messageInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });

    // Settings button click
    elements.settingsBtn.addEventListener('click', () => settingsManager.show());
}

// Initialize settings
settingsManager;

// Set up the experimental models checkbox
const setupExperimentalModelsCheckbox = () => {
    const checkbox = document.getElementById('enforceExperimentalModels');
    if (checkbox) {
        // Set initial state from localStorage
        checkbox.checked = localStorage.getItem('enforceExperimentalModels') === 'true';
    }
};

// Save all the settings to localStorage
const saveSettings = () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const deepgramApiKey = document.getElementById('deepgramApiKey').value.trim();
    const selectedModel = document.getElementById('modelSelection').value;
    const systemInstructions = document.getElementById('systemInstructions').value.trim();
    const enforceExperimentalModels = document.getElementById('enforceExperimentalModels').checked;

    // Basic validation
    if (!apiKey) {
        alert('API key is required');
        return false;
    }

    // Save to localStorage
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('deepgramApiKey', deepgramApiKey);
    localStorage.setItem('selectedModel', selectedModel);
    localStorage.setItem('systemInstructions', systemInstructions);
    localStorage.setItem('enforceExperimentalModels', enforceExperimentalModels);

    return true;
};

// Setup settings dialog
const setupSettingsDialog = () => {
    const settingsDialog = document.getElementById('settingsDialog');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const settingsSaveBtn = document.getElementById('settingsSaveBtn');
    
    if (!settingsDialog || !settingsOverlay || !settingsBtn || !settingsCloseBtn || !settingsSaveBtn) {
        return;
    }

    // Setup initial values
    const apiKeyInput = document.getElementById('apiKey');
    const deepgramApiKeyInput = document.getElementById('deepgramApiKey');
    const modelSelection = document.getElementById('modelSelection');
    const systemInstructions = document.getElementById('systemInstructions');

    if (apiKeyInput) {
        apiKeyInput.value = localStorage.getItem('apiKey') || '';
    }
    
    if (deepgramApiKeyInput) {
        deepgramApiKeyInput.value = localStorage.getItem('deepgramApiKey') || '';
    }
    
    if (modelSelection) {
        const savedModel = localStorage.getItem('selectedModel');
        if (savedModel) {
            modelSelection.value = savedModel;
        }
    }
    
    if (systemInstructions) {
        systemInstructions.value = localStorage.getItem('systemInstructions') || '';
    }
    
    // Setup experimental models checkbox
    setupExperimentalModelsCheckbox();

    // Open settings
    settingsBtn.addEventListener('click', () => {
        settingsDialog.classList.add('active');
        settingsOverlay.classList.add('active');
    });

    // Close settings
    settingsCloseBtn.addEventListener('click', () => {
        settingsDialog.classList.remove('active');
        settingsOverlay.classList.remove('active');
    });

    // Close when clicking outside
    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
            settingsDialog.classList.remove('active');
            settingsOverlay.classList.remove('active');
        }
    });

    // Save settings
    settingsSaveBtn.addEventListener('click', () => {
        if (saveSettings()) {
            settingsDialog.classList.remove('active');
            settingsOverlay.classList.remove('active');
            
            // Reload the page to apply new settings
            // This ensures the correct model is loaded
            window.location.reload();
        }
    });
};
