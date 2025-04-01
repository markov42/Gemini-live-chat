const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('path')

let mainWindow; // Reference to the main window

function createWindow () {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        transparent: true,
        backgroundColor: '#00000000',
        titleBarStyle: 'hiddenInset',
        frame: process.platform !== 'darwin', // Use default frame on Windows/Linux, hidden on macOS
        webPreferences: {
            nodeIntegration: false, // is default value after Electron v5
            contextIsolation: true, // protect against prototype pollution
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // Set vibrancy effect for macOS
    if (process.platform === 'darwin') {
        mainWindow.setVibrancy('fullscreen-ui');
    }

    // Load the index.html file from the client folder
    mainWindow.loadFile(path.join(__dirname, '../client/index.html'))
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