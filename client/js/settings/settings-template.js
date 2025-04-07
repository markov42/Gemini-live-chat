export const settingsTemplate = `
<div class="settings-group">
    <label for="modelType">AI Model</label>
    <select id="modelType">
        <option value="gemini">Google Gemini</option>
        <option value="openai">OpenAI</option>
    </select>
</div>

<div id="geminiSettingsGroup" class="model-specific-settings">
    <div class="settings-group">
        <label for="geminiApiKey">Gemini API Key</label>
        <input type="password" id="geminiApiKey" placeholder="Enter your Gemini API key">
    </div>
    
    <div class="settings-group">
        <label for="geminiModelName">Gemini Model</label>
        <select id="geminiModelName">
            <option value="models/gemini-2.0-flash-exp">Gemini 2.0 Flash (Default)</option>
            <option value="models/gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="models/gemini-1.5-pro">Gemini 1.5 Pro</option>
        </select>
    </div>
</div>

<div id="openaiSettingsGroup" class="model-specific-settings" style="display:none;">
    <div class="settings-group">
        <label for="openaiApiKey">OpenAI API Key</label>
        <input type="password" id="openaiApiKey" placeholder="Enter your OpenAI API key">
    </div>
    
    <div class="settings-group">
        <label for="openaiModelName">OpenAI Model</label>
        <select id="openaiModelName">
            <option value="gpt-4o">GPT-4o (Default)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
        </select>
    </div>
</div>

<div class="settings-group">
    <label for="deepgramApiKey">Deepgram API Key (Optional)</label>
    <input type="password" id="deepgramApiKey" placeholder="Enter your Deepgram API key">
</div>

<div class="settings-group">
    <div class="collapsible" id="systemInstructionsToggle">System Instructions ▼</div>
    <div class="collapsible-content">
        <label for="systemInstructions">Custom system instructions for the AI</label>
        <textarea id="systemInstructions" placeholder="Enter custom system instructions for the AI model..." rows="4"></textarea>
    </div>
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