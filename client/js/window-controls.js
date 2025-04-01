/**
 * Window controls management for Electron app
 * Handles custom title bar buttons and platform-specific behavior
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if we're running in Electron
    const isElectron = window.navigator.userAgent.toLowerCase().indexOf('electron/') > -1;
    if (!isElectron) return;

    // Detect platform and add appropriate class
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
        document.body.classList.add('darwin');
    } else {
        // For Windows and Linux, we need custom window controls
        setupCustomWindowControls();
    }
});

/**
 * Sets up custom window control buttons for non-macOS platforms
 */
function setupCustomWindowControls() {
    // Create window controls container
    const windowControls = document.createElement('div');
    windowControls.className = 'window-controls';

    // Create minimize button
    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'window-control-btn minimize-btn';
    minimizeBtn.title = 'Minimize';
    minimizeBtn.addEventListener('click', () => {
        if (window.api && window.api.minimizeWindow) {
            window.api.minimizeWindow();
        }
    });

    // Create maximize/restore button
    const maximizeBtn = document.createElement('button');
    maximizeBtn.className = 'window-control-btn maximize-btn';
    maximizeBtn.title = 'Maximize';
    maximizeBtn.addEventListener('click', () => {
        if (window.api && window.api.maximizeWindow) {
            window.api.maximizeWindow();
        }
    });

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'window-control-btn close-btn';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => {
        if (window.api && window.api.closeWindow) {
            window.api.closeWindow();
        }
    });

    // Add buttons to container
    windowControls.appendChild(minimizeBtn);
    windowControls.appendChild(maximizeBtn);
    windowControls.appendChild(closeBtn);

    // Add container to body
    document.body.appendChild(windowControls);
} 