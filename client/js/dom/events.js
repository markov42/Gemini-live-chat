import elements from './elements.js';
import settingsManager from '../settings/settings-manager.js';

let isCameraActive = false;

/**
 * Ensures the agent is connected and initialized
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
 * Checks if the current model is OpenAI
 */
const isOpenAIModel = () => {
    const modelType = localStorage.getItem('modelType') || 'gemini';
    return modelType === 'openai';
};

/**
 * Sets up event listeners for the application's UI elements
 */
export function setupEventListeners(agent) {
    connectAgentOnStartup(agent);
    
    // Only set up media controls if not using OpenAI
    if (!isOpenAIModel()) {
        setupMediaControls(agent);
        setupScreenSharing(agent);
    } else {
        disableMediaFeatures();
    }
    
    setupMessageHandling(agent);
    setupSettingsButton();
    setupKeyboardShortcuts(agent);
}

/**
 * Disables media features when using OpenAI
 */
function disableMediaFeatures() {
    // Disable media buttons with visual indication
    elements.micBtn.classList.add('disabled');
    elements.cameraBtn.classList.add('disabled');
    elements.screenBtn.classList.add('disabled');
    
    // Add tooltips to explain why features are disabled
    elements.micBtn.title = 'Microphone not available with OpenAI';
    elements.cameraBtn.title = 'Camera not available with OpenAI';
    elements.screenBtn.title = 'Screen sharing not available with OpenAI';
}

function connectAgentOnStartup(agent) {
    (async () => {
        try {
            await ensureAgentReady(agent);
        } catch (error) {
            console.error('Error auto-connecting:', error);
        }
    })();
}

function setupMediaControls(agent) {
    // Microphone toggle handler
    elements.micBtn.addEventListener('click', async () => {
        try {
            await ensureAgentReady(agent);
            await agent.toggleMic();
            elements.micBtn.classList.toggle('active');
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
}

function setupScreenSharing(agent) {
    let isScreenShareActive = false;
    
    // Listen for screen share stopped events
    agent.on('screenshare_stopped', () => {
        elements.screenBtn.classList.remove('active');
        isScreenShareActive = false;
    });

    // Left-click handler for screen button
    elements.screenBtn.addEventListener('click', async () => {
        try {
            if (isScreenShareActive) {
                await agent.stopScreenShare();
                elements.screenBtn.classList.remove('active');
                isScreenShareActive = false;
            } else {
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
    
    // Right-click handler for screen button
    elements.screenBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!isScreenShareActive) {
            showContextMenu(e, createScreenContextMenu(agent, isScreenShareActive, () => {
                isScreenShareActive = true;
                elements.screenBtn.classList.add('active');
            }));
        }
    });
}

function createScreenContextMenu(agent, isActive, onActivate) {
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
        
        contextMenu.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            if (!action) return;
            
            hideContextMenu();
            
            try {
                await ensureAgentReady(agent);
                
                if (action === 'share-default' && !isActive) {
                    await agent.startScreenShare(false);
                    onActivate();
                } else if (action === 'select-source' && !isActive) {
                    await agent.startScreenShare(true);
                    onActivate();
                }
            } catch (error) {
                console.error('Error in screen share action:', error);
                elements.screenBtn.classList.remove('active');
            }
        });
    }
    
    return contextMenu;
}

function showContextMenu(event, contextMenu) {
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.display = 'block';
    
    event.preventDefault();
    
    const hideOnClickOutside = (e) => {
        if (!contextMenu.contains(e.target) && e.target !== event.target) {
            hideContextMenu();
            document.removeEventListener('click', hideOnClickOutside);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', hideOnClickOutside);
    }, 10);
}

function hideContextMenu() {
    const contextMenu = document.getElementById('screenContextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

function setupMessageHandling(agent) {
    const sendMessage = async () => {
        try {
            await ensureAgentReady(agent);
            const text = elements.messageInput.value.trim();
            if (text) {
                await agent.sendText(text);
                elements.messageInput.value = '';
            }
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
}

function setupSettingsButton() {
    elements.settingsBtn.addEventListener('click', () => {
        settingsManager.show();
    });
}

function setupKeyboardShortcuts(agent) {
    document.addEventListener('keydown', async (e) => {
        if (isActiveInputElement()) return;
        
        if (e.altKey) {
            handleAltKeyShortcuts(e);
        }
    });
}

function isActiveInputElement() {
    const tag = document.activeElement.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
}

function handleAltKeyShortcuts(e) {
    switch (e.key) {
        case 'm':
            elements.micBtn.click();
            break;
        case 'c':
            elements.cameraBtn.click();
            break;
        case 's':
            elements.screenBtn.click();
            break;
    }
}
