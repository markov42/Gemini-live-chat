/**
 * BaseModel - Abstract base class for AI model implementations
 * Defines the interface that all model providers must implement
 */
export class BaseModel {
    constructor(config = {}) {
        this._eventListeners = new Map();
        this.config = config;
        this.isConnected = false;
    }

    /**
     * Registers an event listener for the specified event
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} callback - Function to call when the event occurs
     */
    on(eventName, callback) {
        if (!this._eventListeners.has(eventName)) {
            this._eventListeners.set(eventName, []);
        }
        this._eventListeners.get(eventName).push(callback);
    }

    /**
     * Emits an event with the specified data
     * @param {string} eventName - Name of the event to emit
     * @param {any} data - Data to pass to the event listeners
     */
    emit(eventName, data) {
        if (!this._eventListeners.has(eventName)) {
            return;
        }
        for (const callback of this._eventListeners.get(eventName)) {
            callback(data);
        }
    }

    /**
     * Establishes a connection to the AI model service
     * @returns {Promise} Resolves when the connection is established
     */
    async connect() {
        throw new Error('Method connect() must be implemented by subclass');
    }

    /**
     * Disconnects from the AI model service
     */
    disconnect() {
        throw new Error('Method disconnect() must be implemented by subclass');
    }

    /**
     * Sends a text message to the AI model
     * @param {string} text - The text to send
     * @param {boolean} endOfTurn - Whether this is the end of the user's turn
     */
    async sendText(text, endOfTurn = true) {
        throw new Error('Method sendText() must be implemented by subclass');
    }

    /**
     * Sends an image to the AI model
     * @param {string} base64image - Base64 encoded image data
     */
    async sendImage(base64image) {
        throw new Error('Method sendImage() must be implemented by subclass');
    }

    /**
     * Sends audio data to the AI model
     * @param {string} base64audio - Base64 encoded audio data
     */
    async sendAudio(base64audio) {
        throw new Error('Method sendAudio() must be implemented by subclass');
    }

    /**
     * Sends a tool/function response back to the model
     * @param {Object} toolResponse - The response from a tool call
     */
    async sendToolResponse(toolResponse) {
        throw new Error('Method sendToolResponse() must be implemented by subclass');
    }
} 