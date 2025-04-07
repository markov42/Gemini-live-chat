export class ChatManager {
    constructor() {
        this.chatContainer = document.getElementById('chatHistory');
        this.currentStreamingMessage = null;
        this.lastUserMessageType = null; // 'text' or 'audio'
        this.currentTranscript = ''; // Add this to store accumulated transcript
        this.enableCodeValidation = true; // Default to true, can be disabled if tests fail
        this.currentStreamedContent = ''; // Add this to track current content
        
        // Initialize the validation system
        this.initCodeValidation();
    }
    
    // Initialize code validation system
    initCodeValidation() {
        try {
            this.enableCodeValidation = true;
            console.debug('Code validation enabled');
        } catch (error) {
            console.error('Error initializing code validation:', error);
            this.enableCodeValidation = false;
        }
    }

    // Enhanced function to format markdown
    formatMarkdown(text) {
        // Create a reference to this to use in the callback function
        const self = this;
        
        // Process code blocks with language specification - ensure all regex patterns match correctly
        text = text.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]+?)```/g, function(match, language, code) {
            // Fix common language label issues
            if (language.includes('python') || language.includes('py')) {
                language = 'python';
            } else if (language.includes('javascript') || language.includes('js')) {
                language = 'javascript';
            } else if (language.includes('input') || language.includes('plain') || language.includes('text')) {
                // Handle input/output examples as plaintext
                language = 'plaintext';
            } else if (language && !['plaintext', 'text', 'output', 'c', 'cpp', 'java', 'csharp', 'ruby', 'go', 'typescript'].includes(language)) {
                // If language is not recognized, default to plaintext instead of using an unknown language
                console.log(`Unrecognized language: ${language}, defaulting to plaintext`);
                language = 'plaintext';
            }
            
            const displayLang = language || 'plaintext';
            const langClass = language ? `language-${language}` : 'language-plaintext';
            
            // Check if this is an input/output example rather than actual code
            if ((code.includes('Input:') && code.includes('Output:')) || 
                (code.trim().startsWith('Input:')) || 
                language.includes('input')) {
                // Don't treat input/output examples as code - use simple formatting
                return `<div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span class="code-language-indicator">Example</span>
                        <button class="copy-code-button" title="Copy text">Copy</button>
                    </div>
                    <pre class="code-block"><code class="language-plaintext">${self.preserveIndentation(self.escapeHtml(code))}</code></pre>
                </div>`;
            }
            
            // Make sure the code is properly escaped before any processing
            code = self.escapeHtml(code);
            
            // Fix common code issues before validation
            if (code) {
                // Fix missing spaces in common keywords like 'return' followed immediately by a value
                code = code.replace(/\b(return|if|for|while)(&lt;|&gt;|\w+)/g, '$1 $2');
                
                // Fix common spacing issues around operators (with escaped HTML)
                code = code.replace(/([a-zA-Z0-9_])(\+|\-|\*|\/|\=|&lt;|&gt;)([a-zA-Z0-9_])/g, '$1 $2 $3');
            }
            
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
                    <span class="code-language-indicator">${self.escapeHtml(displayLang)}</span>
                    ${wasCodeCorrected ? '<span class="code-corrected-indicator" title="Code was automatically corrected for consistency">✓</span>' : ''}
                    <button class="copy-code-button" title="Copy code">Copy</button>
                </div>
                <pre class="code-block"><code class="${langClass}">${self.preserveIndentation(code)}</code></pre>
            </div>`;
        });
        
        // Custom handling for input/output examples that aren't in code blocks
        // Look for patterns like "Input: [...] Output: [...]" that are on their own lines
        const inputOutputRegex = /^(Input:\s*.+\s*Output:\s*.+)$/gm;
        text = text.replace(inputOutputRegex, function(match, example) {
            return `<div class="code-block-wrapper">
                <div class="code-block-header">
                    <span class="code-language-indicator">Example</span>
                    <button class="copy-code-button" title="Copy text">Copy</button>
                </div>
                <pre class="code-block"><code class="language-plaintext">${self.preserveIndentation(self.escapeHtml(example))}</code></pre>
            </div>`;
        });
        
        // Handle inline code (single backtick) - make sure inline code is properly processed
        text = text.replace(/`([^`]+)`/g, function(match, code) {
            return `<code>${self.preserveCodeFormatting(code)}</code>`;
        });
        
        // Handle headers - improve detection by adding checks for headers without preceding newlines
        text = text.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
        text = text.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
        text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Also detect headers that might not be at the start of a line (OpenAI sometimes formats this way)
        // The key is to add a line break before the heading to ensure it's on its own line
        text = text.replace(/([^\n])##### (.*$)/gm, '$1\n<h5>$2</h5>');
        text = text.replace(/([^\n])#### (.*$)/gm, '$1\n<h4>$2</h4>');
        text = text.replace(/([^\n])### (.*$)/gm, '$1\n<h3>$2</h3>');
        text = text.replace(/([^\n])## (.*$)/gm, '$1\n<h2>$2</h2>');
        text = text.replace(/([^\n])# (.*$)/gm, '$1\n<h1>$2</h1>');
        
        // Special case detection for headings without # prefix but with common heading names
        // (e.g., "Problem Statement", "Approach", "Solution", etc.)
        const commonHeadings = [
            'Problem Statement', 'Problem Description', 'Problem', 
            'Approach', 'Solution', 'Algorithm', 'Implementation',
            'Complexity', 'Time Complexity', 'Space Complexity',
            'Analysis', 'Example', 'Examples', 'Test Cases',
            'Summary', 'Conclusion', 'Discussion', 'Results',
            'Background', 'Introduction', 'Context'
        ];
        
        // Create a regex pattern for common headings
        const headingPattern = new RegExp(`([^\\n])(${commonHeadings.join('|')}):\\s`, 'g');
        text = text.replace(headingPattern, '$1\n<h3>$2:</h3>\n');
        
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
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // New helper to preserve indentation on already-escaped code
    preserveIndentation(escapedCode) {
        if (!escapedCode) return '';
        // Preserve leading spaces by replacing spaces with non-breaking spaces
        // Handle any amount of leading whitespace (even a single space) for Python indentation
        return escapedCode.replace(/^( +)/gm, match => '&nbsp;'.repeat(match.length));
    }

    // New helper to preserve code indentation while escaping HTML
    preserveCodeFormatting(code) {
        if (!code) return '';
        return this.preserveIndentation(this.escapeHtml(code));
    }

    // New function to validate code blocks for consistency
    validateCodeBlock(code, language) {
        try {
            // Don't try to modify already escaped code for now
            // This is a safer approach until we can properly handle escaped HTML entities
            if (code.includes('&lt;') || code.includes('&gt;') || code.includes('&amp;')) {
                return code;
            }
            
            // First check for consistent variable naming
            const variableNameMap = {};
            let updatedCode = code;
            
            // Add common domain-specific variable patterns
            const commonVariablePatterns = {
                'trapped_water': ['trappedWater', 'trapped_water', 'water_trapped', 'waterTrapped', 'trapped', 'water'],
                'max_profit': ['maxProfit', 'max_profit', 'profit_max', 'profitMax', 'profit', 'max_p'],
                'result_array': ['resultArray', 'result_array', 'array_result', 'arrayResult', 'results', 'res_array'],
                'nums': ['numbers', 'num', 'arr', 'array', 'input_array', 'inputArray'],
                'left_pointer': ['leftPointer', 'left_pointer', 'pointer_left', 'pointerLeft', 'left', 'l_ptr'],
                'right_pointer': ['rightPointer', 'right_pointer', 'pointer_right', 'pointerRight', 'right', 'r_ptr']
            };
            
            // Match and collect variable declarations with common patterns
            const varNameRegex = /\b(let|var|const|function|def)\s+([a-zA-Z0-9_$]+)\b|\b([a-zA-Z0-9_$]+)\s*[\=\:]\s*|\bfunction\s+([a-zA-Z0-9_$]+)|\([^)]*\)\s*=>\s*{|\bclass\s+([a-zA-Z0-9_$]+)/g;
            let match;
            while ((match = varNameRegex.exec(code)) !== null) {
                const varName = match[2] || match[3] || match[4] || match[5];
                if (varName) {
                    // Store original form of variable name
                    variableNameMap[varName.toLowerCase()] = varName;
                }
            }
            
            // Match parameter names in function declarations
            const functionParamRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)|def\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/g;
            while ((match = functionParamRegex.exec(code)) !== null) {
                const params = match[2] || match[4];
                if (params) {
                    // Parse parameter list
                    const paramsList = params.split(',').map(p => p.trim());
                    paramsList.forEach(param => {
                        // Extract parameter name (handles patterns like "paramName = defaultValue")
                        const paramName = param.split(/[\=\:]/)[0].trim();
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
                'boolean': ['bool', 'b'],
                'trappedwater': ['trapped_water', 'water_trapped', 'trapped', 'water'],
                'maxheight': ['max_height', 'height_max', 'maximum_height', 'max_h']
            };
            
            // Add domain-specific patterns to the common variant map
            Object.entries(commonVariablePatterns).forEach(([standard, variants]) => {
                if (!commonVariants[standard.toLowerCase().replace('_', '')]) {
                    commonVariants[standard.toLowerCase().replace('_', '')] = variants;
                }
            });
            
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
        // Silently validate without logging
        return true;
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
                // Ensure content is sanitized before formatting
                const sanitizedContent = this.currentStreamedContent;
                const formattedContent = this.formatMarkdown(sanitizedContent);
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
            
            // Ensure we scroll to bottom after finalizing
            this.scrollToBottom();
        }
    }

    /**
     * Updates the streaming message with new text
     * @param {string} text - The text fragment to add to the streaming message
     */
    updateStreamingMessage(text) {
        // Ensure text is a string (guard against undefined or null)
        const textFragment = text?.toString() || '';
        
        if (textFragment) {
            // Check if the new text is a complete message that includes our current content
            if (this.currentStreamedContent && textFragment.includes(this.currentStreamedContent)) {
                // If so, just use the new text as it's more complete
                this.currentStreamedContent = textFragment;
            } else {
                // Otherwise append the new text
                this.currentStreamedContent += textFragment;
            }
            
            // If we don't have a streaming message element yet, create one
            if (!this.currentStreamingMessage) {
                this.startModelMessage();
            }
            
            // Keep a reference to the current message element in case it changes during async operations
            const currentMessage = this.currentStreamingMessage;
            
            // Update the message content with markdown formatting
            const messageContent = currentMessage.querySelector('.message-content');
            if (messageContent) {
                messageContent.innerHTML = this.formatMarkdown(this.currentStreamedContent);
            }
            
            // Apply syntax highlighting to any code blocks
            this.applySyntaxHighlighting();
            
            // Scroll to the bottom to keep the latest content visible
            this.scrollToBottom();
            
            // Schedule less critical operations for the next frame to avoid blocking rendering
            requestAnimationFrame(() => {
                // Check if the message is still the current streaming message
                // It might have been finalized between when we started this update and now
                if (this.currentStreamingMessage === currentMessage) {
                    this.checkCodeBlocksScrollable();
                    this.setupCopyButtons();
                }
            });
        }
    }

    // New function to setup copy button event listeners
    setupCopyButtons() {
        if (!this.currentStreamingMessage) return;
        
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
        if (!this.currentStreamingMessage) return;
        
        if (window.hljs) {
            const codeBlocks = this.currentStreamingMessage.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                // Only highlight blocks that haven't been highlighted yet
                if (!block.classList.contains('hljs')) {
                    try {
                        // Double-check that the content is properly escaped
                        const content = block.textContent;
                        
                        // Get the language class
                        const classNames = block.className.split(' ');
                        const languageClass = classNames.find(c => c.startsWith('language-'));
                        
                        // Check if this is a plaintext example (like Input/Output examples) and skip highlighting
                        const isPlaintext = languageClass === 'language-plaintext' || !languageClass;
                        const isExample = content.includes('Input:') && content.includes('Output:');
                        
                        if (isPlaintext || isExample) {
                            // For plaintext, just ensure HTML is escaped but don't apply syntax highlighting
                            block.innerHTML = this.escapeHtml(content);
                            block.classList.add('hljs'); // Mark as processed
                            return;
                        }
                        
                        // Check if this is Python code (special handling for indentation)
                        const isPython = languageClass && languageClass.includes('language-python');
                        
                        // If we need to re-escape - first clear the current content
                        block.innerHTML = this.escapeHtml(content);
                        
                        // For Python, ensure indentation is preserved perfectly
                        if (isPython) {
                            // Replace all leading spaces with non-breaking spaces to preserve indentation
                            const lines = block.innerHTML.split('\n');
                            const formattedLines = lines.map(line => {
                                return line.replace(/^( +)/g, match => '&nbsp;'.repeat(match.length));
                            });
                            block.innerHTML = formattedLines.join('\n');
                        }
                        
                        // Now highlight the safely escaped content
                        window.hljs.highlightElement(block);
                    } catch (e) {
                        console.error("Error highlighting code:", e);
                    }
                }
            });
        }
        
        // Check if code blocks are scrollable and add indicator
        this.checkCodeBlocksScrollable();
    }
    
    // New function to check if code blocks are scrollable
    checkCodeBlocksScrollable() {
        if (!this.currentStreamingMessage) return;
        
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

    addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.innerHTML = `<div class="message-content">${text}</div>`;
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
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