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
        
        // Process code blocks with language specification
        text = text.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]+?)```/g, function(match, language, code) {
            const displayLang = language || 'plaintext';
            const langClass = language ? `language-${language}` : 'language-plaintext';
            
            return `<div class="code-block-wrapper">
                <div class="code-block-header">
                    <span class="code-language-indicator">${displayLang}</span>
                    <button class="copy-code-button" title="Copy code">Copy</button>
                </div>
                <pre class="code-block"><code class="${langClass}">${self.escapeHtml(code)}</code></pre>
            </div>`;
        });
        
        // Handle inline code (single backtick)
        text = text.replace(/`([^`]+)`/g, function(match, code) {
            return `<code>${self.escapeHtml(code)}</code>`;
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
        
        // Improved paragraph handling:
        // 1. Split the text into sections at double newlines
        // 2. Process each section separately
        // 3. Skip wrapping sections that are already wrapped in HTML tags
        
        // First, ensure consistent newlines for paragraph splitting
        text = text.replace(/\n{3,}/g, '\n\n'); // Reduce more than 2 consecutive newlines to just 2
        
        // Split by double newlines and process each paragraph
        const paragraphs = text.split(/\n\n+/);
        text = paragraphs.map(para => {
            para = para.trim();
            if (!para) return '';
            
            // Skip wrapping if this is already HTML content
            if (
                /^<(\w+).*>.*<\/\1>$/s.test(para) || // Complete HTML tag
                para.startsWith('<li>') ||
                para.startsWith('<h') ||
                para.startsWith('<ul') ||
                para.startsWith('<ol') ||
                para.startsWith('<div') ||
                para.startsWith('<pre') ||
                para.startsWith('<code')
            ) {
                return para;
            }
            
            // Wrap in paragraph tags
            return `<p>${para}</p>`;
        }).join('\n\n');
        
        // No need for placeholder replacements anymore, as we're handling code directly
        
        // Clean up empty paragraphs
        text = text.replace(/<p><\/p>/g, '');
        
        // Add extra spacing between paragraphs and other block elements
        text = text.replace(/(<\/p>)(<[ph])/g, '$1\n$2');
        text = text.replace(/(<\/pre>)(<[ph])/g, '$1\n$2');
        text = text.replace(/(<\/h\d>)(<[ph])/g, '$1\n$2');
        text = text.replace(/(<div class="code-block-wrapper">)(<[ph])/g, '$1\n$2');
        text = text.replace(/(<\/div>)(<[ph])/g, '$1\n$2');
        
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
        
        // Append new text while trimming leading/trailing spaces
        this.currentTranscript += text;
        
        try {
            // Format the complete transcript each time
            this.currentStreamingMessage.innerHTML = this.formatMarkdown(this.currentTranscript);
            
            // Add event listeners to copy buttons
            this.setupCopyButtons();
            
            // Apply syntax highlighting 
            this.applySyntaxHighlighting();
        } catch (error) {
            console.error("Error formatting markdown:", error);
            // Fallback to plain text
            this.currentStreamingMessage.textContent = this.currentTranscript;
        }
        this.scrollToBottom();
    }

    // New function to setup copy button event listeners
    setupCopyButtons() {
        const copyButtons = this.currentStreamingMessage.querySelectorAll('.copy-code-button');
        copyButtons.forEach(button => {
            // Only add event listener if it doesn't already have one
            if (!button.hasAttribute('data-listener-added')) {
                button.addEventListener('click', () => {
                    const codeBlock = button.closest('.code-block-wrapper').querySelector('code');
                    const textToCopy = codeBlock.textContent;
                    
                    navigator.clipboard.writeText(textToCopy)
                        .then(() => {
                            // Change button text temporarily
                            const originalText = button.textContent;
                            button.textContent = 'Copied!';
                            setTimeout(() => {
                                button.textContent = originalText;
                            }, 2000);
                        })
                        .catch(err => {
                            console.error('Could not copy text: ', err);
                        });
                });
                
                // Mark button as having an event listener
                button.setAttribute('data-listener-added', 'true');
            }
        });
    }
    
    // New function to apply syntax highlighting
    applySyntaxHighlighting() {
        if (window.hljs) {
            const codeBlocks = this.currentStreamingMessage.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                if (!block.classList.contains('hljs')) {
                    window.hljs.highlightElement(block);
                }
            });
        }
    }

    finalizeStreamingMessage() {
        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.classList.remove('streaming');
            
            // Final setup of copy buttons and syntax highlighting
            this.setupCopyButtons();
            this.applySyntaxHighlighting();
            
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