import elements from './elements.js';
import settingsManager from '../settings/settings-manager.js';

let isCameraActive = false;

/**
 * Ensures the agent is connected and initialized
 * @param {GeminiAgent} agent - The main application agent instance
 * @returns {Promise<void>}
 */
const ensureAgentReady = async (agent) => {
    if (!agent.connected) {
        await agent.connect();
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
    // Connect the agent automatically on startup
    (async () => {
        try {
            await ensureAgentReady(agent);
        } catch (error) {
            console.error('Error auto-connecting:', error);
        }
    })();

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

    // Settings button handler
    elements.settingsBtn.addEventListener('click', () => {
        settingsManager.show();
    });
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', async (e) => {
        // Only process if not in an input/textarea field
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }
        
        // Alt+M: Toggle microphone
        if (e.altKey && e.key === 'm') {
            elements.micBtn.click();
        }
        
        // Alt+C: Toggle camera
        if (e.altKey && e.key === 'c') {
            elements.cameraBtn.click();
        }
        
        // Alt+S: Toggle screen sharing
        if (e.altKey && e.key === 's') {
            elements.screenBtn.click();
        }
    });
}
