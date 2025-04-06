export const settingsTemplate = `
<div class="settings-group">
    <label for="apiKey">Gemini API Key</label>
    <input type="password" id="apiKey" placeholder="Enter your Gemini API key">
</div>

<div class="settings-group">
    <label for="modelSelection">AI Model</label>
    <select id="modelSelection">
        <option value="models/gemini-2.0-flash-exp">Gemini 2.0 Flash (Streaming, Audio & Video)</option>
        <option value="models/gemini-2.5-pro-preview-03-25">Gemini 2.5 Pro (Best for Coding)</option>
        <option value="models/gemini-1.5-pro">Gemini 1.5 Pro (Reasoning)</option>
        <option value="models/gemini-1.5-flash">Gemini 1.5 Flash (Fast Responses)</option>
    </select>
    <div class="settings-note">
        Note: Only Gemini 2.0 Flash supports streaming audio and video features. Other models will use text-only mode.
    </div>
</div>

<div class="settings-group">
    <label for="systemInstructions">System Instructions</label>
    <textarea id="systemInstructions" placeholder="Enter custom instructions for the AI (e.g., 'You are a helpful assistant')" rows="4"></textarea>
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