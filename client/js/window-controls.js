/**
 * Window controls management for Electron app
 * Handles custom title bar buttons and platform-specific behavior
 */

document.addEventListener('DOMContentLoaded', () => {
    const isElectron = window.navigator.userAgent.toLowerCase().indexOf('electron/') > -1;
    if (!isElectron) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
        document.body.classList.add('darwin');
    } else {
        setupCustomWindowControls();
    }
});

/**
 * Sets up custom window control buttons for non-macOS platforms
 */
function setupCustomWindowControls() {
    const windowControls = document.createElement('div');
    windowControls.className = 'window-controls';

    const minimizeBtn = createWindowButton('minimize-btn', 'Minimize', () => {
        if (window.api?.minimizeWindow) {
            window.api.minimizeWindow();
        }
    });

    const maximizeBtn = createWindowButton('maximize-btn', 'Maximize', () => {
        if (window.api?.maximizeWindow) {
            window.api.maximizeWindow();
        }
    });

    const closeBtn = createWindowButton('close-btn', 'Close', () => {
        if (window.api?.closeWindow) {
            window.api.closeWindow();
        }
    });

    windowControls.appendChild(minimizeBtn);
    windowControls.appendChild(maximizeBtn);
    windowControls.appendChild(closeBtn);

    document.body.appendChild(windowControls);
}

function createWindowButton(className, title, clickHandler) {
    const button = document.createElement('button');
    button.className = `window-control-btn ${className}`;
    button.title = title;
    button.addEventListener('click', clickHandler);
    return button;
} 