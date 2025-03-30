export class ChatManager {
    constructor() {
        this.chatContainer = document.getElementById('chatHistory');
        this.currentStreamingMessage = null;
        this.lastUserMessageType = null; // 'text' or 'audio'
        this.currentTranscript = ''; // Add this to store accumulated transcript
    }

    // Enhanced function to format markdown
    formatMarkdown(text) {
        // Create a reference to this to use in the callback function
        const self = this;
        
        // First, handle code blocks
        text = text.replace(/```(.+?)\n([\s\S]+?)```/g, function(match, language, code) {
            return `<pre class="code-block"><code class="language-${language}">${self.escapeHtml(code)}</code></pre>`;
        });
        
        // Handle headers
        text = text.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
        text = text.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
        text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Handle bold, italic, and bold+italic
        text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Handle links
        text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
        
        // Handle unordered lists (*, -, +)
        let hasUnorderedList = text.match(/^\s*[\*\-\+]\s+/gm);
        if (hasUnorderedList) {
            text = text.replace(/^\s*[\*\-\+]\s+(.*)/gm, '<li>$1</li>');
            text = text.replace(/(?:(?!<\/li>).)*(<li>.*<\/li>)(?:(?!<li>).)*/, '<ul>$1</ul>');
        }
        
        // Handle ordered lists (1., 2., etc) - only convert if it's actually a list
        let hasOrderedList = text.match(/^\s*\d+\.\s+/gm);
        if (hasOrderedList) {
            text = text.replace(/^\s*\d+\.\s+(.*)/gm, '<li>$1</li>');
            text = text.replace(/(?:(?!<\/li>).)*(<li>.*<\/li>)(?:(?!<li>).)*/, '<ol>$1</ol>');
        }
        
        // Handle paragraphs - only if not already in a list or code block
        if (!hasOrderedList && !hasUnorderedList) {
            text = text.replace(/\n\s*\n/g, '</p><p>');
            text = '<p>' + text + '</p>';
        }
        
        // Clean up empty paragraphs
        text = text.replace(/<p><\/p>/g, '');
        
        return text;
    }

    // Helper to escape HTML special characters
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user-message';
        messageDiv.textContent = text;
        this.chatContainer.appendChild(messageDiv);
        this.lastUserMessageType = 'text';
        this.scrollToBottom();
    }

    addUserAudioMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user-message';
        messageDiv.textContent = 'User sent audio';
        this.chatContainer.appendChild(messageDiv);
        this.lastUserMessageType = 'audio';
        this.scrollToBottom();
    }

    startModelMessage() {
        // If there's already a streaming message, finalize it first
        if (this.currentStreamingMessage) {
            this.finalizeStreamingMessage();
        }

        // If no user message was shown yet, show audio message
        if (!this.lastUserMessageType) {
            this.addUserAudioMessage();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message model-message streaming';
        this.chatContainer.appendChild(messageDiv);
        this.currentStreamingMessage = messageDiv;
        this.currentTranscript = ''; // Reset transcript when starting new message
        this.scrollToBottom();
    }

    updateStreamingMessage(text) {
        if (!this.currentStreamingMessage) {
            this.startModelMessage();
        }
        this.currentTranscript += ' ' + text;
        try {
            // Use our simple markdown formatter instead of marked
            this.currentStreamingMessage.innerHTML = this.formatMarkdown(this.currentTranscript);
        } catch (error) {
            console.error("Error formatting markdown:", error);
            // Fallback to plain text
            this.currentStreamingMessage.textContent = this.currentTranscript;
        }
        this.scrollToBottom();
    }

    finalizeStreamingMessage() {
        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.classList.remove('streaming');
            this.currentStreamingMessage = null;
            this.lastUserMessageType = null;
            this.currentTranscript = ''; // Reset transcript when finalizing
        }
    }

    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    clear() {
        this.chatContainer.innerHTML = '';
        this.currentStreamingMessage = null;
        this.lastUserMessageType = null;
        this.currentTranscript = '';
    }
} 