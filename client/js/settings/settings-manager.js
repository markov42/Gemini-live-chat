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

        // Cache DOM elements - only keep the ones we need
        this.elements = {
            dialog: this.dialog,
            overlay: this.overlay,
            apiKeyInput: this.dialog.querySelector('#apiKey'),
            deepgramApiKeyInput: this.dialog.querySelector('#deepgramApiKey'),
            systemInstructionsToggle: this.dialog.querySelector('#systemInstructionsToggle'),
            systemInstructionsContent: this.dialog.querySelector('#systemInstructionsToggle + .collapsible-content'),
            systemInstructionsTextarea: this.dialog.querySelector('#systemInstructions'),
            deviceToggle: this.dialog.querySelector('#deviceToggle'),
            deviceContent: this.dialog.querySelector('#deviceToggle + .collapsible-content'),
            audioInputSelect: this.dialog.querySelector('#audioInput'),
            videoInputSelect: this.dialog.querySelector('#videoInput'),
            refreshDevicesBtn: this.dialog.querySelector('#refreshDevicesBtn'),
            saveBtn: this.dialog.querySelector('#settingsSaveBtn')
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

        // Toggle devices section
        this.elements.deviceToggle.addEventListener('click', () => {
            this.toggleCollapsible(this.elements.deviceToggle, this.elements.deviceContent);
        });

        // Toggle system instructions section
        this.elements.systemInstructionsToggle.addEventListener('click', () => {
            this.toggleCollapsible(this.elements.systemInstructionsToggle, this.elements.systemInstructionsContent);
        });

        // Refresh devices button
        this.elements.refreshDevicesBtn.addEventListener('click', () => {
            this.enumerateDevices();
        });
    }

    async enumerateDevices() {
        try {
            const deviceInfos = await navigator.mediaDevices.enumerateDevices();
            
            // Clear existing options except the default ones
            while (this.elements.audioInputSelect.options.length > 1) {
                this.elements.audioInputSelect.options.remove(1);
            }
            
            while (this.elements.videoInputSelect.options.length > 1) {
                this.elements.videoInputSelect.options.remove(1);
            }
            
            // Add the available devices to the select elements
            for (const deviceInfo of deviceInfos) {
                const option = document.createElement('option');
                option.value = deviceInfo.deviceId;
                
                if (deviceInfo.kind === 'audioinput') {
                    option.text = deviceInfo.label || `Microphone ${this.elements.audioInputSelect.options.length}`;
                    this.elements.audioInputSelect.appendChild(option);
                } else if (deviceInfo.kind === 'videoinput') {
                    option.text = deviceInfo.label || `Camera ${this.elements.videoInputSelect.options.length}`;
                    this.elements.videoInputSelect.appendChild(option);
                }
            }
            
            // Set selected values if previously selected devices exist
            const selectedAudioDeviceId = localStorage.getItem('selectedAudioDeviceId');
            const selectedVideoDeviceId = localStorage.getItem('selectedVideoDeviceId');
            
            if (selectedAudioDeviceId) {
                this.elements.audioInputSelect.value = selectedAudioDeviceId;
            }
            
            if (selectedVideoDeviceId) {
                this.elements.videoInputSelect.value = selectedVideoDeviceId;
            }
        } catch (err) {
            console.error('Error accessing media devices:', err);
        }
    }

    loadSettings() {
        // Load values from localStorage - only keep the ones we need
        this.elements.apiKeyInput.value = localStorage.getItem('apiKey') || '';
        this.elements.deepgramApiKeyInput.value = localStorage.getItem('deepgramApiKey') || '';
        
        // Default enhanced system instructions if none are set
        const defaultInstructions = `You are a helpful assistant. When greeting the user for the first time, introduce yourself and provide a list of things you can help with, such as:

1. Answering questions and providing information on a wide range of topics
2. Assisting with coding tasks and debugging code issues
3. Generating creative content like stories or ideas
4. Explaining complex concepts in simple terms
5. Helping with language translation and grammar
6. Providing recommendations based on user preferences
7. Assisting with math and scientific calculations
8. Helping organize thoughts and plans

Remember to be friendly, helpful, and tailor your responses to the user's needs.`;
        
        this.elements.systemInstructionsTextarea.value = localStorage.getItem('systemInstructions') || defaultInstructions;
    }

    saveSettings() {
        localStorage.setItem('apiKey', this.elements.apiKeyInput.value);
        localStorage.setItem('deepgramApiKey', this.elements.deepgramApiKeyInput.value);
        localStorage.setItem('systemInstructions', this.elements.systemInstructionsTextarea.value);
        
        // Save selected device IDs
        localStorage.setItem('selectedAudioDeviceId', this.elements.audioInputSelect.value);
        localStorage.setItem('selectedVideoDeviceId', this.elements.videoInputSelect.value);
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