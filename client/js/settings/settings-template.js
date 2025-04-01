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

<div class="settings-group">
    <label for="voice">Voice</label>
    <select id="voice">
        <option value="Puck">Puck</option>
        <option value="Charon">Charon</option>
        <option value="Kore">Kore</option>
        <option value="Fenrir">Fenrir</option>
        <option value="Aoede">Aoede</option>
    </select>
</div>

<div class="settings-group">
    <label for="sampleRate">Sample Rate</label>
    <input type="range" id="sampleRate" min="8000" max="48000" step="1000">
    <span id="sampleRateValue"></span>
</div>

<div class="settings-group">
    <div class="collapsible" id="systemInstructionsToggle">System Instructions ▼</div>
    <div class="collapsible-content">
        <textarea id="systemInstructions" rows="4" placeholder="Enter system instructions"></textarea>
    </div>
</div>

<div class="settings-group">
    <div class="collapsible" id="screenCameraToggle">Screen&Camera ▼</div>
    <div class="collapsible-content">
        <div class="settings-group">
            <label for="fps">FPS (1-10)</label>
            <input type="range" id="fps" min="1" max="10" step="1">
            <span id="fpsValue"></span>
        </div>
        <div class="settings-group">
            <label for="resizeWidth">Resize Width (640-1920)</label>
            <input type="range" id="resizeWidth" min="640" max="1920" step="80">
            <span id="resizeWidthValue"></span>
        </div>
        <div class="settings-group">
            <label for="quality">Quality (0.1-1)</label>
            <input type="range" id="quality" min="0.1" max="1" step="0.1">
            <span id="qualityValue"></span>
        </div>
        <div class="settings-group">
            <div class="checkbox-container">
                <input type="checkbox" id="showScreenSelectionDialog">
                <label for="showScreenSelectionDialog">Always show screen selection dialog</label>
            </div>
            <div class="help-text">When enabled, you will be prompted to select which screen or window to share each time.</div>
        </div>
    </div>
</div>

<div class="settings-group">
    <div class="collapsible" id="advancedToggle">Advanced Settings ▼</div>
    <div class="collapsible-content">
        <div class="settings-group">
            <label for="temperature">Temperature (0-2)</label>
            <input type="range" id="temperature" min="0" max="2" step="0.1">
            <span id="temperatureValue"></span>
        </div>
        <div class="settings-group">
            <label for="topP">Top P (0-1)</label>
            <input type="range" id="topP" min="0" max="1" step="0.05">
            <span id="topPValue"></span>
        </div>
        <div class="settings-group">
            <label for="topK">Top K (1-100)</label>
            <input type="range" id="topK" min="1" max="100" step="1">
            <span id="topKValue"></span>
        </div>
    </div>
</div>

<div class="settings-group">
    <div class="collapsible" id="safetyToggle">Safety Settings (Blocking Strength) ▼</div>
    <div class="collapsible-content">
        <div class="settings-group">
            <label for="harassmentThreshold">Harassment (0-3)</label>
            <input type="range" id="harassmentThreshold" min="0" max="3" step="1">
            <span id="harassmentValue"></span>
        </div>
        <div class="settings-group">
            <label for="dangerousContentThreshold">Dangerous Content (0-3)</label>
            <input type="range" id="dangerousContentThreshold" min="0" max="3" step="1">
            <span id="dangerousValue"></span>
        </div>
        <div class="settings-group">
            <label for="sexuallyExplicitThreshold">Sexually Explicit (0-3)</label>
            <input type="range" id="sexuallyExplicitThreshold" min="0" max="3" step="1">
            <span id="sexualValue"></span>
        </div>
        <div class="settings-group">
            <label for="civicIntegrityThreshold">Civic Integrity (0-3)</label>
            <input type="range" id="civicIntegrityThreshold" min="0" max="3" step="1">
            <span id="civicValue"></span>
        </div>
    </div>
</div>

<button id="settingsSaveBtn" class="settings-save-btn">Save Settings</button>`; 