const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('path')

let mainWindow; // Reference to the main window

function createWindow () {
    // Create the browser window with consistent transparency settings
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        transparent: true,
        backgroundColor: '#00000000', // Fully transparent background
        titleBarStyle: 'hiddenInset',
        frame: process.platform !== 'darwin', // Use default frame on Windows/Linux, hidden on macOS
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        },
        // Set constant opacity and disable auto focus/blur behavior
        opacity: 0.95,
        hasShadow: false,
        // New setting to prevent visual changes on focus/blur
        focusable: true
    })
    
    // Completely prevent any default Electron focus/blur appearance changes
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    
    // For macOS, disable automatic appearance change on blur
    if (process.platform === 'darwin') {
        app.commandLine.appendSwitch('disable-renderer-backgrounding');
        mainWindow.setWindowButtonVisibility(true);
    }

    // Load the index.html file from the client folder
    mainWindow.loadFile(path.join(__dirname, '../client/index.html'))

    // Use specific event to completely override the focus/blur appearance
    mainWindow.on('blur', () => {
        // Force complete redraw with correct settings
        mainWindow.setBackgroundColor('#00000000');
        mainWindow.setOpacity(0.95);
        // Wait for next tick to ensure changes take effect
        setTimeout(() => {
            if (mainWindow) {
                // For macOS, force redraw by slightly moving the window
                const bounds = mainWindow.getBounds();
                bounds.width += 1;
                mainWindow.setBounds(bounds);
                bounds.width -= 1;
                mainWindow.setBounds(bounds);
                
                // Force window to show with correct transparency
                mainWindow.showInactive();
            }
        }, 10);
    });
    
    // Ensure focus state maintains same appearance
    mainWindow.on('focus', () => {
        mainWindow.setBackgroundColor('#00000000');
        mainWindow.setOpacity(0.95);
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// Window control handlers
ipcMain.on('MINIMIZE_WINDOW', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('MAXIMIZE_WINDOW', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('CLOSE_WINDOW', () => {
    if (mainWindow) mainWindow.close();
});

// Handle get sources request
ipcMain.handle('GET_SOURCES', async (event) => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            fetchWindowIcons: true
        });
        return sources;
    } catch (error) {
        console.error('Error getting sources:', error);
        throw error;
    }
}) 