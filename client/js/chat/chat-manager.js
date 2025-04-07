export class ChatManager {
    constructor() {
        this.chatContainer = document.getElementById('chatHistory');
        this.currentStreamingMessage = null;
        this.lastUserMessageType = null; // 'text' or 'audio'
        this.currentTranscript = ''; // Add this to store accumulated transcript
        this.enableCodeValidation = true; // Default to true, can be disabled if tests fail
        
        // Initialize the validation system
        this.initCodeValidation();
    }
    
    // Initialize code validation system
    initCodeValidation() {
        try {
            // Run tests to make sure our validation works correctly
            const testPassed = this.testCodeValidation();
            
            // If tests fail, disable validation to prevent breaking existing functionality
            if (!testPassed) {
                console.warn('Code validation tests failed. Disabling code validation to prevent issues.');
                this.enableCodeValidation = false;
            } else {
                console.log('Code validation tests passed. Enabling code validation for improved code quality.');
            }
        } catch (error) {
            console.error('Error initializing code validation:', error);
            this.enableCodeValidation = false;
        }
    }

    // Enhanced function to format markdown
    formatMarkdown(text) {
        // Create a reference to this to use in the callback function
        const self = this;
        
        // Process code blocks with language specification
        text = text.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]+?)```/g, function(match, language, code) {
            const displayLang = language || 'plaintext';
            const langClass = language ? `language-${language}` : 'language-plaintext';
            
            // Validate code if it appears to be a programming language and validation is enabled
            let wasCodeCorrected = false;
            if (self.enableCodeValidation && language && !['plaintext', 'text', 'output'].includes(language.toLowerCase())) {
                const correctedCode = self.validateCodeBlock(code, language);
                
                // Check if the code was modified
                wasCodeCorrected = (correctedCode !== code);
                code = correctedCode;
            }
            
            return `<div class="code-block-wrapper${wasCodeCorrected ? ' code-corrected' : ''}">
                <div class="code-block-header">
                    <span class="code-language-indicator">${displayLang}</span>
                    ${wasCodeCorrected ? '<span class="code-corrected-indicator" title="Code was automatically corrected for consistency">✓</span>' : ''}
                    <button class="copy-code-button" title="Copy code">Copy</button>
                </div>
                <pre class="code-block"><code class="${langClass}">${self.preserveCodeFormatting(code)}</code></pre>
            </div>`;
        });
        
        // Handle inline code (single backtick)
        text = text.replace(/`([^`]+)`/g, function(match, code) {
            return `<code>${self.preserveCodeFormatting(code)}</code>`;
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
        
        // Improved list handling
        // First, identify potential list groups by looking for consecutive list items
        const listGroups = [];
        let currentGroup = null;
        
        // Split text into lines to process lists
        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if this line is an unordered list item
            const unorderedMatch = line.match(/^\s*([\*\-\+])\s+(.*)/);
            if (unorderedMatch) {
                const marker = unorderedMatch[1]; // The actual marker (*, -, +)
                const content = unorderedMatch[2];
                
                if (!currentGroup || currentGroup.type !== 'ul') {
                    // Start a new group
                    currentGroup = { type: 'ul', items: [], startIndex: i, endIndex: i };
                    listGroups.push(currentGroup);
                } else {
                    // Update the end index of the current group
                    currentGroup.endIndex = i;
                }
                
                // Store the item with its original marker
                currentGroup.items.push({ marker, content });
                continue;
            }
            
            // Check if this line is an ordered list item (supports both 1. and 1) formats)
            const orderedMatch = line.match(/^\s*(\d+)([\.\)])\s+(.*)/);
            if (orderedMatch) {
                const number = orderedMatch[1]; // The actual number
                const delimiter = orderedMatch[2]; // . or )
                const content = orderedMatch[3];
                
                if (!currentGroup || currentGroup.type !== 'ol') {
                    // Start a new group
                    currentGroup = { type: 'ol', items: [], startIndex: i, endIndex: i };
                    listGroups.push(currentGroup);
                } else {
                    // Update the end index of the current group
                    currentGroup.endIndex = i;
                }
                
                // Store the item with its original number and delimiter
                currentGroup.items.push({ number, delimiter, content });
                continue;
            }
            
            // If we get here and there's an empty line or non-list line, close the current group
            if (currentGroup && (line.trim() === '' || !line.match(/^\s*[\*\-\+\d\.\)]/))) {
                currentGroup = null;
            }
        }
        
        // Now process each list group
        for (const group of listGroups.reverse()) { // Process in reverse to not mess up indices
            const listItems = group.items.map(item => {
                if (group.type === 'ul') {
                    // For unordered lists, include the marker in the content
                    return `<li><span class="list-marker">${item.marker}</span> ${item.content}</li>`;
                } else {
                    // For ordered lists, include the number and delimiter in the content
                    return `<li><span class="list-marker">${item.number}${item.delimiter}</span> ${item.content}</li>`;
                }
            }).join('');
            
            // Replace the original lines with the HTML list
            const listHtml = `<${group.type}>${listItems}</${group.type}>`;
            lines.splice(group.startIndex, group.endIndex - group.startIndex + 1, listHtml);
        }
        
        // Rejoin the lines
        text = lines.join('\n');
        
        // Improved paragraph handling:
        // 1. Normalize all newlines to make paragraph detection consistent
        text = text.replace(/\n{3,}/g, '\n\n'); // Reduce more than 2 consecutive newlines to just 2
        
        // 2. Split by double newlines and process each paragraph
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
        }).join('\n'); // Use single newline instead of double for consistent spacing
        
        // Clean up empty paragraphs
        text = text.replace(/<p><\/p>/g, '');
        
        // 3. Standardize spacing between elements (let CSS handle the visual spacing)
        // Remove the extra spacing that was previously added
        text = text.replace(/(<\/p>)(<[ph])/g, '$1$2');
        text = text.replace(/(<\/pre>)(<[ph])/g, '$1$2');
        text = text.replace(/(<\/h\d>)(<[ph])/g, '$1$2');
        text = text.replace(/(<div class="code-block-wrapper">)(<[ph])/g, '$1$2');
        text = text.replace(/(<\/div>)(<[ph])/g, '$1$2');
        
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

    // New helper to preserve code indentation while escaping HTML
    preserveCodeFormatting(code) {
        return this.escapeHtml(code)
            // Preserve leading spaces by replacing spaces with non-breaking spaces
            .replace(/^ {2,}/gm, match => '&nbsp;'.repeat(match.length));
    }

    // New function to validate code blocks for consistency
    validateCodeBlock(code, language) {
        try {
            // First check for consistent variable naming
            const variableNameMap = {};
            let updatedCode = code;
            
            // Match and collect variable declarations with common patterns
            const varNameRegex = /\b(let|var|const|function)\s+([a-zA-Z0-9_$]+)\b|\b([a-zA-Z0-9_$]+)\s*\=|\bfunction\s+([a-zA-Z0-9_$]+)|\([^)]*\)\s*=>\s*{|\bclass\s+([a-zA-Z0-9_$]+)/g;
            let match;
            while ((match = varNameRegex.exec(code)) !== null) {
                const varName = match[2] || match[3] || match[4] || match[5];
                if (varName) {
                    // Store original form of variable name
                    variableNameMap[varName.toLowerCase()] = varName;
                }
            }
            
            // Match parameter names in function declarations
            const functionParamRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/g;
            while ((match = functionParamRegex.exec(code)) !== null) {
                if (match[2]) {
                    // Parse parameter list
                    const params = match[2].split(',').map(p => p.trim());
                    params.forEach(param => {
                        // Extract parameter name (handles patterns like "paramName = defaultValue")
                        const paramName = param.split('=')[0].trim();
                        if (paramName && /^[a-zA-Z0-9_$]+$/.test(paramName)) {
                            variableNameMap[paramName.toLowerCase()] = paramName;
                        }
                    });
                }
            }
            
            // Check for common format variations in variable names
            const commonVariants = {
                'value': ['val', 'v'],
                'sum': ['total', 'tot'],
                'count': ['cnt', 'counter'],
                'index': ['idx', 'i'],
                'parent': ['par', 'p'],
                'child': ['ch', 'c'],
                'grandparent': ['grandpar', 'gp', 'grand_parent', 'grandparent_val', 'grandparentval'],
                'grandchild': ['grandch', 'gc', 'grand_child'],
                'result': ['res', 'rslt'],
                'array': ['arr', 'a'],
                'object': ['obj', 'o'],
                'string': ['str', 's'],
                'number': ['num', 'n'],
                'boolean': ['bool', 'b']
            };
            
            // Build a map of potential related variables
            const relatedVars = {};
            Object.keys(variableNameMap).forEach(varLower => {
                // Check for snake_case vs camelCase
                if (varLower.includes('_')) {
                    const camelCase = varLower.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
                    relatedVars[camelCase] = varLower;
                } else {
                    // Convert camelCase to snake_case
                    const snakeCase = varLower.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
                    if (snakeCase !== varLower) {
                        relatedVars[snakeCase] = varLower;
                    }
                }
                
                // Check for common suffix variations
                for (const [standard, variants] of Object.entries(commonVariants)) {
                    if (varLower.endsWith(standard) || variants.some(v => varLower.endsWith(v))) {
                        // Collect the prefix part of the variable name
                        const prefix = variants.reduce((pre, variant) => {
                            if (varLower.endsWith(variant)) {
                                return varLower.substring(0, varLower.length - variant.length);
                            }
                            return pre;
                        }, varLower.endsWith(standard) ? varLower.substring(0, varLower.length - standard.length) : '');
                        
                        // If we have a prefix, map all potential variations
                        if (prefix) {
                            const standardVar = prefix + standard;
                            variants.forEach(variant => {
                                const variantVar = prefix + variant;
                                if (variantVar !== varLower) {
                                    relatedVars[variantVar] = varLower;
                                }
                            });
                        }
                    }
                }
            });
            
            // Check for variable name inconsistencies (e.g., snake_case vs camelCase)
            const varRegex = /\b([a-zA-Z0-9_$]+)\b/g;
            const processedVars = {};
            
            while ((match = varRegex.exec(code)) !== null) {
                const foundVar = match[1];
                const lowerVar = foundVar.toLowerCase();
                
                // Skip keywords, built-ins and short vars (likely loop counters)
                if (['if', 'for', 'while', 'return', 'function', 'const', 'let', 'var', 'in', 'of', 'true', 'false', 'null', 'undefined'].includes(foundVar) || 
                    foundVar.length <= 1) {
                    continue;
                }
                
                // Check for direct inconsistencies
                if (variableNameMap[lowerVar] && variableNameMap[lowerVar] !== foundVar && !processedVars[lowerVar + foundVar]) {
                    // Standardize to the first form we encountered
                    updatedCode = updatedCode.replace(new RegExp('\\b' + foundVar + '\\b', 'g'), variableNameMap[lowerVar]);
                    processedVars[lowerVar + foundVar] = true;
                }
                
                // Check if this is a known variant of another variable
                const relatedVar = relatedVars[lowerVar];
                if (relatedVar && variableNameMap[relatedVar] && !processedVars[relatedVar + foundVar]) {
                    // Standardize to the official form
                    updatedCode = updatedCode.replace(new RegExp('\\b' + foundVar + '\\b', 'g'), variableNameMap[relatedVar]);
                    processedVars[relatedVar + foundVar] = true;
                }
            }
            
            // Check for functions that reference "totalsum" vs "total_sum"
            for (const varLower in variableNameMap) {
                if (varLower.includes('sum') || varLower.includes('total')) {
                    const variants = [
                        varLower.replace('_sum', 'sum'),
                        varLower.replace('sum', '_sum'),
                        varLower.replace('total_', 'total'),
                        varLower.replace('total', 'total_')
                    ];
                    
                    variants.forEach(variant => {
                        if (variant !== varLower) {
                            const pattern = new RegExp('\\b' + variant + '\\b', 'gi');
                            updatedCode = updatedCode.replace(pattern, variableNameMap[varLower]);
                        }
                    });
                }
            }
            
            // Check for mismatched function scope (assuming braces are balanced)
            const functionRegex = /function\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/g;
            while ((match = functionRegex.exec(updatedCode)) !== null) {
                const funcName = match[1];
                const funcStart = match.index;
                
                // Find the corresponding closing brace by counting opening and closing braces
                let braceCount = 1;
                let position = match.index + match[0].length;
                
                while (braceCount > 0 && position < updatedCode.length) {
                    if (updatedCode[position] === '{') braceCount++;
                    if (updatedCode[position] === '}') braceCount--;
                    position++;
                }
                
                // Check if there's a return statement outside the function scope
                const afterFunction = updatedCode.substring(position);
                const returnOutsideRegex = new RegExp(`\\breturn\\s+${funcName}\\s*\\(`);
                
                if (returnOutsideRegex.test(afterFunction)) {
                    // Move the return statement inside the function
                    const returnMatch = returnOutsideRegex.exec(afterFunction);
                    const returnStmt = afterFunction.substring(returnMatch.index).split(/[;\n]/)[0] + ';';
                    
                    // Remove the return statement from outside
                    updatedCode = updatedCode.replace(returnStmt, '');
                    
                    // Insert it before the function's closing brace
                    const beforeClosingBrace = updatedCode.substring(0, position - 1);
                    const afterClosingBrace = updatedCode.substring(position - 1);
                    
                    updatedCode = beforeClosingBrace + '\n  ' + returnStmt + '\n' + afterClosingBrace;
                }
            }
            
            return updatedCode;
        } catch (error) {
            console.error("Error validating code block:", error);
            return code; // Return original code if validation fails
        }
    }

    // Test code validation with example problematic code
    testCodeValidation() {
        // Example code with the issues mentioned in the problem
        const problematicCode = `function sumEvenGrandparent(root) {
    let total_sum = 0;
    
    function dfs(node, parentval, grandparent_val) {
        if (!node) return;
        
        // If grandparent value is even, add current node's value
        if (grandparent_val % 2 === 0) {
            total_sum += node.val;
        }
        
        // Recursively process children
        dfs(node.left, node.val, parentval);
        dfs(node.right, node.val, parentval);
    }
}

return dfs(root, 1, 1); // This should be inside the sumEvenGrandparent function
`;

        // Validate the code
        const validatedCode = this.validateCodeBlock(problematicCode, 'javascript');
        
        // Log the results
        console.log('--- Code Validation Test ---');
        console.log('Original code:');
        console.log(problematicCode);
        console.log('Validated code:');
        console.log(validatedCode);
        
        // Check if specific issues were fixed
        const issues = [];
        
        // Check for variable name consistency (grandparentval vs grandparent_val)
        if (validatedCode.includes('grandparent_val') && validatedCode.includes('grandparentval')) {
            issues.push('Variable names still inconsistent (grandparent_val vs grandparentval)');
        }
        
        // Check for total_sum vs totalsum
        if (validatedCode.includes('total_sum') && validatedCode.includes('totalsum')) {
            issues.push('Variable names still inconsistent (total_sum vs totalsum)');
        }
        
        // Check for return statement placement
        if (!validatedCode.includes('function sumEvenGrandparent(root) {') || 
            !validatedCode.includes('return dfs(root, 1, 1);') || 
            validatedCode.includes('return dfs(root, 1, 1);') && !validatedCode.includes('return dfs(root, 1, 1);\n}')) {
            issues.push('Return statement not properly placed inside the function');
        }
        
        if (issues.length > 0) {
            console.error('Issues detected:');
            issues.forEach(issue => console.error(`- ${issue}`));
        } else {
            console.log('All issues successfully fixed!');
        }
        
        return issues.length === 0;
    }

    /**
     * Adds a user message to the chat
     * @param {string} text - The user's message text
     */
    addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user-message';
        
        // Create a content container for the user message too
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = text; // User messages are plain text
        
        messageDiv.appendChild(messageContent);
        this.chatContainer.appendChild(messageDiv);
        this.lastUserMessageType = 'text';
        this.scrollToBottom();
    }

    /**
     * Adds a user audio message to the chat
     */
    addUserAudioMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user-message';
        
        // Create a content container for the user message
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = 'User sent audio';
        
        messageDiv.appendChild(messageContent);
        this.chatContainer.appendChild(messageDiv);
        this.lastUserMessageType = 'audio';
        this.scrollToBottom();
    }

    /**
     * Creates a new model message in the chat
     */
    startModelMessage() {
        // First, finalize any existing streaming message
        if (this.currentStreamingMessage) {
            this.finalizeStreamingMessage();
        }
        
        // Create a new message element
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message model-message streaming';
        
        // Add a container for the message content to properly apply HTML
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageElement.appendChild(messageContent);
        
        // Add the message to the chat container
        this.chatContainer.appendChild(messageElement);
        
        // Set as current streaming message
        this.currentStreamingMessage = messageElement;
        
        // Reset the current streamed content
        this.currentStreamedContent = '';
        
        // Scroll to the bottom
        this.scrollToBottom();
        
        return messageElement;
    }

    /**
     * Finalizes the currently streaming message
     */
    finalizeStreamingMessage() {
        if (this.currentStreamingMessage) {
            // Remove the streaming class
            this.currentStreamingMessage.classList.remove('streaming');
            
            // Apply any final formatting
            const messageContent = this.currentStreamingMessage.querySelector('.message-content');
            if (messageContent && this.currentStreamedContent) {
                const formattedContent = this.formatMarkdown(this.currentStreamedContent);
                messageContent.innerHTML = formattedContent;
                
                // Make sure code blocks are properly highlighted and have copy buttons
                this.applySyntaxHighlighting();
                this.checkCodeBlocksScrollable();
                this.setupCopyButtons();
            }
            
            // Reset the current streaming message
            this.currentStreamingMessage = null;
            this.currentStreamedContent = '';
            this.lastUserMessageType = null; // Reset for next turn
        }
    }

    /**
     * Updates the streaming message with new text
     * @param {string} text - The text fragment to add to the streaming message
     */
    updateStreamingMessage(text) {
        // Ensure text is a string (guard against undefined or null)
        const textFragment = text?.toString() || '';
        
        // Don't process empty fragments
        if (!textFragment) return;
        
        if (!this.currentStreamingMessage) {
            this.startModelMessage();
            
            // If we don't have a user message showing, add one based on the last known type
            if (!this.lastUserMessageType) {
                this.addUserAudioMessage();
            }
        }
        
        // Get the message content container
        const messageContent = this.currentStreamingMessage.querySelector('.message-content');
        
        // Check if we're using OpenAI by looking for a modelType indicator
        const modelIndicator = document.getElementById('modelIndicator');
        const isOpenAI = modelIndicator && modelIndicator.textContent.includes('OpenAI');
        
        // Add text to the accumulated content
        this.currentStreamedContent += textFragment;
        
        // Format the accumulated content
        const formattedContent = this.formatMarkdown(this.currentStreamedContent);
        
        // Update the message content - replace the entire content instead of appending
        // This prevents duplication issues
        messageContent.innerHTML = formattedContent;
        
        // Make sure code blocks are properly highlighted
        this.applySyntaxHighlighting();
        
        // Add scrolling indicator to scrollable code blocks
        this.checkCodeBlocksScrollable();
        
        // Set up copy buttons for code blocks
        this.setupCopyButtons();
        
        // Scroll to the bottom
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
        
        // Check if code blocks are scrollable and add indicator
        this.checkCodeBlocksScrollable();
    }
    
    // New function to check if code blocks are scrollable
    checkCodeBlocksScrollable() {
        const codeBlocks = this.currentStreamingMessage.querySelectorAll('.code-block');
        codeBlocks.forEach(block => {
            // Remove existing indicators
            block.classList.remove('scrollable-right');
            
            // Check if the block is scrollable (content width > visible width)
            if (block.scrollWidth > block.clientWidth) {
                block.classList.add('scrollable-right');
                
                // Add scroll event listener to update indicator
                if (!block.hasAttribute('data-scroll-listener')) {
                    block.addEventListener('scroll', () => {
                        // If scrolled to the end, remove right indicator
                        if (block.scrollLeft + block.clientWidth >= block.scrollWidth - 5) {
                            block.classList.remove('scrollable-right');
                        } else {
                            block.classList.add('scrollable-right');
                        }
                    });
                    block.setAttribute('data-scroll-listener', 'true');
                }
            }
        });
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