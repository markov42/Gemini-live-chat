import { settingsTemplate } from './settings-template.js';

class SettingsManager {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.loadSettings();
        this.enumerateDevices();
    }

    initializeElements() {
        // Create settings dialog and overlay
        this.dialog = document.createElement('div');
        this.dialog.className = 'settings-dialog';
        this.dialog.innerHTML = settingsTemplate;

        this.overlay = document.createElement('div');
        this.overlay.className = 'settings-overlay';

        // Add to document
        document.body.appendChild(this.dialog);
        document.body.appendChild(this.overlay);

        // Cache DOM elements
        this.elements = {
            dialog: this.dialog,
            overlay: this.overlay,
            apiKeyInput: this.dialog.querySelector('#apiKey'),
            deepgramApiKeyInput: this.dialog.querySelector('#deepgramApiKey'),
            voiceSelect: this.dialog.querySelector('#voice'),
            sampleRateInput: this.dialog.querySelector('#sampleRate'),
            sampleRateValue: this.dialog.querySelector('#sampleRateValue'),
            systemInstructionsToggle: this.dialog.querySelector('#systemInstructionsToggle'),
            systemInstructionsContent: this.dialog.querySelector('#systemInstructions').parentElement,
            systemInstructionsInput: this.dialog.querySelector('#systemInstructions'),
            screenCameraToggle: this.dialog.querySelector('#screenCameraToggle'),
            screenCameraContent: this.dialog.querySelector('#screenCameraToggle + .collapsible-content'),
            fpsInput: this.dialog.querySelector('#fps'),
            fpsValue: this.dialog.querySelector('#fpsValue'),
            resizeWidthInput: this.dialog.querySelector('#resizeWidth'),
            resizeWidthValue: this.dialog.querySelector('#resizeWidthValue'),
            qualityInput: this.dialog.querySelector('#quality'),
            qualityValue: this.dialog.querySelector('#qualityValue'),
            advancedToggle: this.dialog.querySelector('#advancedToggle'),
            advancedContent: this.dialog.querySelector('#advancedToggle + .collapsible-content'),
            temperatureInput: this.dialog.querySelector('#temperature'),
            temperatureValue: this.dialog.querySelector('#temperatureValue'),
            topPInput: this.dialog.querySelector('#topP'),
            topPValue: this.dialog.querySelector('#topPValue'),
            topKInput: this.dialog.querySelector('#topK'),
            topKValue: this.dialog.querySelector('#topKValue'),
            safetyToggle: this.dialog.querySelector('#safetyToggle'),
            safetyContent: this.dialog.querySelector('#safetyToggle + .collapsible-content'),
            harassmentInput: this.dialog.querySelector('#harassmentThreshold'),
            harassmentValue: this.dialog.querySelector('#harassmentValue'),
            dangerousInput: this.dialog.querySelector('#dangerousContentThreshold'),
            dangerousValue: this.dialog.querySelector('#dangerousValue'),
            sexualInput: this.dialog.querySelector('#sexuallyExplicitThreshold'),
            sexualValue: this.dialog.querySelector('#sexualValue'),
            civicInput: this.dialog.querySelector('#civicIntegrityThreshold'),
            civicValue: this.dialog.querySelector('#civicValue'),
            deviceToggle: this.dialog.querySelector('#deviceToggle'),
            deviceContent: this.dialog.querySelector('#deviceToggle + .collapsible-content'),
            audioInputSelect: this.dialog.querySelector('#audioInput'),
            videoInputSelect: this.dialog.querySelector('#videoInput'),
            refreshDevicesBtn: this.dialog.querySelector('#refreshDevicesBtn'),
            saveBtn: this.dialog.querySelector('#settingsSaveBtn'),
            screenSelectionDialogCheckbox: this.dialog.querySelector('#showScreenSelectionDialog')
        };
    }

    setupEventListeners() {
        // Close settings when clicking overlay
        this.overlay.addEventListener('click', () => this.hide());

        // Prevent dialog close when clicking inside dialog
        this.dialog.addEventListener('click', (e) => e.stopPropagation());

        // Save settings
        this.elements.saveBtn.addEventListener('click', () => {
            this.saveSettings();
            this.hide();
            window.location.reload();
        });

        // Toggle collapsible sections
        this.elements.systemInstructionsToggle.addEventListener('click', () => {
            this.toggleCollapsible(this.elements.systemInstructionsToggle, this.elements.systemInstructionsContent);
        });

        this.elements.advancedToggle.addEventListener('click', () => {
            this.toggleCollapsible(this.elements.advancedToggle, this.elements.advancedContent);
        });

        this.elements.screenCameraToggle.addEventListener('click', () => {
            this.toggleCollapsible(this.elements.screenCameraToggle, this.elements.screenCameraContent);
        });

        this.elements.safetyToggle.addEventListener('click', () => {
            this.toggleCollapsible(this.elements.safetyToggle, this.elements.safetyContent);
        });
        
        this.elements.deviceToggle.addEventListener('click', () => {
            this.toggleCollapsible(this.elements.deviceToggle, this.elements.deviceContent);
        });

        // Refresh devices button
        this.elements.refreshDevicesBtn.addEventListener('click', () => {
            this.enumerateDevices();
        });

        // Add input listeners for real-time value updates
        const inputElements = [
            'sampleRateInput', 'temperatureInput', 'topPInput', 'topKInput',
            'fpsInput', 'resizeWidthInput', 'qualityInput', 'harassmentInput',
            'dangerousInput', 'sexualInput', 'civicInput'
        ];

        inputElements.forEach(elementName => {
            this.elements[elementName].addEventListener('input', () => this.updateDisplayValues());
        });
    }

    async enumerateDevices() {
        try {
            // Request permission first by requesting a stream (needed in some browsers)
            let initialStream;
            try {
                initialStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            } catch (e) {
                console.warn("Couldn't get initial permission for all devices, trying audio only:", e);
                try {
                    initialStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (e2) {
                    console.warn("Couldn't get audio permission either:", e2);
                }
            }
            
            // Get list of available devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Stop the initial stream we used to get permissions
            if (initialStream) {
                initialStream.getTracks().forEach(track => track.stop());
            }
            
            // Clear previous options except for the default
            while (this.elements.audioInputSelect.options.length > 1) {
                this.elements.audioInputSelect.remove(1);
            }
            
            while (this.elements.videoInputSelect.options.length > 1) {
                this.elements.videoInputSelect.remove(1);
            }
            
            // Add audio input devices
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            audioInputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Microphone ${this.elements.audioInputSelect.options.length}`;
                this.elements.audioInputSelect.appendChild(option);
            });
            
            // Add video input devices
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            videoInputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${this.elements.videoInputSelect.options.length}`;
                this.elements.videoInputSelect.appendChild(option);
            });
            
            // Select saved devices if available
            const savedAudioDeviceId = localStorage.getItem('selectedAudioDeviceId');
            const savedVideoDeviceId = localStorage.getItem('selectedVideoDeviceId');
            
            if (savedAudioDeviceId) {
                this.elements.audioInputSelect.value = savedAudioDeviceId;
            }
            
            if (savedVideoDeviceId) {
                this.elements.videoInputSelect.value = savedVideoDeviceId;
            }
            
        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }

    loadSettings() {
        // Load values from localStorage
        this.elements.apiKeyInput.value = localStorage.getItem('apiKey') || '';
        this.elements.deepgramApiKeyInput.value = localStorage.getItem('deepgramApiKey') || '';
        this.elements.voiceSelect.value = localStorage.getItem('voiceName') || 'Aoede';
        this.elements.sampleRateInput.value = localStorage.getItem('sampleRate') || '27000';
        this.elements.systemInstructionsInput.value = localStorage.getItem('systemInstructions') || 'You are a helpful assistant';
        this.elements.temperatureInput.value = localStorage.getItem('temperature') || '1.8';
        this.elements.topPInput.value = localStorage.getItem('top_p') || '0.95';
        this.elements.topKInput.value = localStorage.getItem('top_k') || '65';

        // Initialize screen & camera settings
        this.elements.fpsInput.value = localStorage.getItem('fps') || '1';
        this.elements.resizeWidthInput.value = localStorage.getItem('resizeWidth') || '640';
        this.elements.qualityInput.value = localStorage.getItem('quality') || '0.3';
        this.elements.screenSelectionDialogCheckbox.checked = localStorage.getItem('showScreenSelectionDialog') === 'true';

        // Initialize safety settings
        this.elements.harassmentInput.value = localStorage.getItem('harassmentThreshold') || '3';
        this.elements.dangerousInput.value = localStorage.getItem('dangerousContentThreshold') || '3';
        this.elements.sexualInput.value = localStorage.getItem('sexuallyExplicitThreshold') || '3';
        this.elements.civicInput.value = localStorage.getItem('civicIntegrityThreshold') || '3';

        this.updateDisplayValues();
    }

    saveSettings() {
        localStorage.setItem('apiKey', this.elements.apiKeyInput.value);
        localStorage.setItem('deepgramApiKey', this.elements.deepgramApiKeyInput.value);
        localStorage.setItem('voiceName', this.elements.voiceSelect.value);
        localStorage.setItem('sampleRate', this.elements.sampleRateInput.value);
        localStorage.setItem('systemInstructions', this.elements.systemInstructionsInput.value);
        localStorage.setItem('temperature', this.elements.temperatureInput.value);
        localStorage.setItem('top_p', this.elements.topPInput.value);
        localStorage.setItem('top_k', this.elements.topKInput.value);
        
        // Save screen & camera settings
        localStorage.setItem('fps', this.elements.fpsInput.value);
        localStorage.setItem('resizeWidth', this.elements.resizeWidthInput.value);
        localStorage.setItem('quality', this.elements.qualityInput.value);
        localStorage.setItem('showScreenSelectionDialog', this.elements.screenSelectionDialogCheckbox.checked);

        // Save safety settings
        localStorage.setItem('harassmentThreshold', this.elements.harassmentInput.value);
        localStorage.setItem('dangerousContentThreshold', this.elements.dangerousInput.value);
        localStorage.setItem('sexuallyExplicitThreshold', this.elements.sexualInput.value);
        localStorage.setItem('civicIntegrityThreshold', this.elements.civicInput.value);
        
        // Save selected device IDs
        localStorage.setItem('selectedAudioDeviceId', this.elements.audioInputSelect.value);
        localStorage.setItem('selectedVideoDeviceId', this.elements.videoInputSelect.value);
    }

    updateDisplayValues() {
        this.elements.sampleRateValue.textContent = this.elements.sampleRateInput.value + ' Hz';
        this.elements.temperatureValue.textContent = this.elements.temperatureInput.value;
        this.elements.topPValue.textContent = this.elements.topPInput.value;
        this.elements.topKValue.textContent = this.elements.topKInput.value;
        this.elements.fpsValue.textContent = this.elements.fpsInput.value + ' FPS';
        this.elements.resizeWidthValue.textContent = this.elements.resizeWidthInput.value + 'px';
        this.elements.qualityValue.textContent = this.elements.qualityInput.value;
        this.elements.harassmentValue.textContent = this.getThresholdLabel(this.elements.harassmentInput.value);
        this.elements.dangerousValue.textContent = this.getThresholdLabel(this.elements.dangerousInput.value);
        this.elements.sexualValue.textContent = this.getThresholdLabel(this.elements.sexualInput.value);
        this.elements.civicValue.textContent = this.getThresholdLabel(this.elements.civicInput.value);
    }

    getThresholdLabel(value) {
        const labels = {
            '0': 'None',
            '1': 'Low',
            '2': 'Medium',
            '3': 'High'
        };
        return labels[value] || value;
    }

    toggleCollapsible(toggle, content) {
        const isActive = content.classList.contains('active');
        content.classList.toggle('active');
        toggle.textContent = toggle.textContent.replace(isActive ? '▼' : '▲', isActive ? '▲' : '▼');
    }

    show() {
        this.dialog.classList.add('active');
        this.overlay.classList.add('active');
    }

    hide() {
        this.dialog.classList.remove('active');
        this.overlay.classList.remove('active');
    }
}

export default new SettingsManager(); 