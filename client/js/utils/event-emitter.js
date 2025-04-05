/**
 * Standardized EventEmitter class for consistent event handling across the application.
 * Provides methods for registering event listeners, emitting events, and removing listeners.
 */
export class EventEmitter {
  constructor() {
    this._eventListeners = new Map();
  }

  /**
   * Registers an event listener for the specified event
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} callback - Function to call when the event occurs
   * @returns {Function} Unsubscribe function to remove this specific listener
   */
  on(eventName, callback) {
    if (!this._eventListeners.has(eventName)) {
      this._eventListeners.set(eventName, new Set());
    }
    this._eventListeners.get(eventName).add(callback);

    // Return an unsubscribe function for easy cleanup
    return () => this.off(eventName, callback);
  }

  /**
   * Registers a one-time event listener that will be removed after being called
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} callback - Function to call when the event occurs
   * @returns {Function} Unsubscribe function to remove this specific listener
   */
  once(eventName, callback) {
    const onceWrapper = (...args) => {
      this.off(eventName, onceWrapper);
      callback.apply(this, args);
    };
    return this.on(eventName, onceWrapper);
  }

  /**
   * Removes an event listener for the specified event
   * @param {string} eventName - Name of the event to remove the listener from
   * @param {Function} callback - The callback function to remove
   * @returns {boolean} True if the listener was removed, false otherwise
   */
  off(eventName, callback) {
    const listeners = this._eventListeners.get(eventName);
    if (!listeners) return false;
    
    const result = listeners.delete(callback);
    
    // Clean up empty listener sets
    if (listeners.size === 0) {
      this._eventListeners.delete(eventName);
    }
    
    return result;
  }

  /**
   * Removes all listeners for the specified event or all events if no event is specified
   * @param {string} [eventName] - Optional name of the event to remove all listeners for
   */
  removeAllListeners(eventName) {
    if (eventName) {
      this._eventListeners.delete(eventName);
    } else {
      this._eventListeners.clear();
    }
  }

  /**
   * Emits an event with the specified arguments
   * @param {string} eventName - Name of the event to emit
   * @param {...any} args - Arguments to pass to the event listeners
   * @returns {boolean} True if there were listeners for the event, false otherwise
   */
  emit(eventName, ...args) {
    const listeners = this._eventListeners.get(eventName);
    if (!listeners || listeners.size === 0) return false;

    // Use Array.from to create a copy of the listeners to avoid issues if
    // a listener modifies the set during iteration
    Array.from(listeners).forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in ${eventName} event handler:`, error);
        // Emit an error event to allow centralized error handling
        if (eventName !== 'error') {
          this.emit('error', error, { eventName, handler: callback });
        }
      }
    });
    
    return true;
  }

  /**
   * Gets the count of listeners for the specified event
   * @param {string} eventName - Name of the event to get the listener count for
   * @returns {number} The number of listeners for the event
   */
  listenerCount(eventName) {
    const listeners = this._eventListeners.get(eventName);
    return listeners ? listeners.size : 0;
  }

  /**
   * Gets the names of all events with registered listeners
   * @returns {Array<string>} Array of event names
   */
  eventNames() {
    return Array.from(this._eventListeners.keys());
  }
}

// Create a singleton instance for global events
export const globalEmitter = new EventEmitter();

// Export a mixin function to easily add event emitter functionality to any class
export function eventEmitterMixin(target) {
  const emitter = new EventEmitter();
  
  // Add event emitter methods to the target
  target.on = emitter.on.bind(emitter);
  target.once = emitter.once.bind(emitter);
  target.off = emitter.off.bind(emitter);
  target.emit = emitter.emit.bind(emitter);
  target.removeAllListeners = emitter.removeAllListeners.bind(emitter);
  target.listenerCount = emitter.listenerCount.bind(emitter);
  target.eventNames = emitter.eventNames.bind(emitter);
  
  // Store the emitter on the target for direct access if needed
  target._eventEmitter = emitter;
  
  return target;
}