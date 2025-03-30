const { BrowserWindow } = require('electron');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset', // This gives you proper spacing for traffic lights
    frame: false, // Hide default window frame
    transparent: true, // Allow for rounded corners
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // Load the index.html
  mainWindow.loadFile('index.html');
} 