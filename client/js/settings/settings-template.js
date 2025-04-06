export const settingsTemplate = `
<div class="settings-group">
    <label for="apiKey">Gemini API Key</label>
    <input type="password" id="apiKey" placeholder="Enter your Gemini API key">
</div>

<div class="settings-group">
    <label for="deepgramApiKey">Deepgram API Key (Optional)</label>
    <input type="password" id="deepgramApiKey" placeholder="Enter your Deepgram API key">
</div>

<div class="settings-group">
    <div class="collapsible" id="deviceToggle">Audio & Video Devices ▼</div>
    <div class="collapsible-content">
        <div class="settings-group">
            <label for="audioInput">Microphone</label>
            <select id="audioInput">
                <option value="default">Default Microphone</option>
                <!-- Will be populated with available devices -->
            </select>
        </div>
        <div class="settings-group">
            <label for="videoInput">Camera</label>
            <select id="videoInput">
                <option value="default">Default Camera</option>
                <!-- Will be populated with available devices -->
            </select>
        </div>
        <button id="refreshDevicesBtn" class="refresh-btn">Refresh Devices</button>
    </div>
</div>

<button id="settingsSaveBtn" class="settings-save-btn">Save Settings</button>`; 