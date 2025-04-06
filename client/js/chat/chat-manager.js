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
            
            // Validate and fix code if it's a programming language
            if (language && ['javascript', 'python', 'java', 'c', 'cpp', 'csharp', 'php', 'ruby', 'go', 'typescript', 'swift'].includes(language.toLowerCase())) {
                code = self.validateCodeBlock(code, language.toLowerCase());
            }
            
            return `<div class="code-block-wrapper">
                <div class="code-block-header">
                    <span class="code-language-indicator">${displayLang}</span>
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

    // New method to validate and fix common code issues
    validateCodeBlock(code, language) {
        try {
            // Store original code in case validation fails
            const originalCode = code;
            
            // Common fixes for all languages
            let fixedCode = code.trim();
            const diagnostics = []; // For tracking changes made
            
            // 1. Variable name consistency check and reference correction
            const variableMap = new Map();
            const similarVariables = new Map(); // Map of normalized names to actual variable names
            
            // Collect all variable declarations and their usages
            const varPattern = language === 'python' ? 
                /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)/g : 
                /\b(var|let|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
            
            // Find variables with similar names (snake_case vs camelCase inconsistencies)
            const allVariables = new Set();
            let match;
            
            if (language === 'python') {
                // Handle Python variable declarations
                while ((match = varPattern.exec(fixedCode)) !== null) {
                    allVariables.add(match[1]);
                }
                
                // Handle function parameters in Python
                const pythonFuncRegex = /\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\):/g;
                while ((match = pythonFuncRegex.exec(fixedCode)) !== null) {
                    const funcName = match[1];
                    const params = match[2].split(',');
                    
                    for (let param of params) {
                        param = param.trim();
                        if (param.includes('=')) {
                            // Handle default parameters
                            param = param.split('=')[0].trim();
                        }
                        if (param) allVariables.add(param);
                    }
                }
            } else {
                // Handle JavaScript/TypeScript variable declarations
                const jsVarRegex = /\b(?:var|let|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
                while ((match = jsVarRegex.exec(fixedCode)) !== null) {
                    allVariables.add(match[1]);
                }
                
                // Also catch function parameters in JS/TS
                const functionParamRegex = /\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;
                while ((match = functionParamRegex.exec(fixedCode)) !== null) {
                    const funcName = match[1];
                    const params = match[2].split(',');
                    
                    for (const param of params) {
                        const trimmed = param.trim();
                        if (trimmed) allVariables.add(trimmed);
                    }
                }
                
                // Arrow functions
                const arrowFuncRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=>\s*{/g;
                while ((match = arrowFuncRegex.exec(fixedCode)) !== null) {
                    allVariables.add(match[1]);
                }
                
                // Class methods
                const classMethodRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*{/g;
                while ((match = classMethodRegex.exec(fixedCode)) !== null) {
                    allVariables.add(match[1]);
                }
            }
            
            // Group similar variables by normalized name
            for (const varName of allVariables) {
                // Normalize: remove underscores and convert to lowercase
                const normalized = varName.replace(/_/g, '').toLowerCase();
                
                if (!similarVariables.has(normalized)) {
                    similarVariables.set(normalized, []);
                }
                similarVariables.get(normalized).push(varName);
            }
            
            // For each group of similar variables, standardize to the first occurrence
            for (const [normalized, variants] of similarVariables.entries()) {
                if (variants.length > 1) {
                    const standardName = variants[0]; // First occurrence becomes the standard
                    
                    // Replace all other variants with the standard name
                    for (let i = 1; i < variants.length; i++) {
                        const beforeFix = fixedCode;
                        const variantRegex = new RegExp(`\\b${variants[i]}\\b`, 'g');
                        fixedCode = fixedCode.replace(variantRegex, standardName);
                        
                        if (beforeFix !== fixedCode) {
                            diagnostics.push(`Renamed variable: ${variants[i]} → ${standardName}`);
                        }
                    }
                }
            }
            
            // 2. Check function scope and return statements
            if (language === 'javascript' || language === 'typescript') {
                // Check for return statements outside function scope
                const functionBlocks = [];
                let depth = 0;
                let inFunction = false;
                let functionStartIndex = -1;
                let currentFunctionName = '';
                
                const lines = fixedCode.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Check for function declarations
                    const funcMatch = line.match(/\bfunction\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/);
                    if (funcMatch) {
                        if (!inFunction) {
                            inFunction = true;
                            functionStartIndex = i;
                            currentFunctionName = funcMatch[1];
                        }
                        depth++;
                    }
                    
                    // Count opening braces
                    const openBraces = (line.match(/\{/g) || []).length;
                    depth += openBraces;
                    
                    // Count closing braces
                    const closeBraces = (line.match(/\}/g) || []).length;
                    depth -= closeBraces;
                    
                    // If we're back to depth 0 and were in a function, record the function block
                    if (depth === 0 && inFunction) {
                        functionBlocks.push({
                            name: currentFunctionName,
                            start: functionStartIndex,
                            end: i
                        });
                        inFunction = false;
                        currentFunctionName = '';
                    }
                }
                
                // Check for return statements outside function blocks
                for (let i = 0; i < lines.length; i++) {
                    if (/^\s*return\s/.test(lines[i])) {
                        let insideFunction = false;
                        let containingFunction = null;
                        
                        for (const block of functionBlocks) {
                            if (i >= block.start && i <= block.end) {
                                insideFunction = true;
                                containingFunction = block;
                                break;
                            }
                        }
                        
                        if (!insideFunction) {
                            // This return is outside a function - try to find the nearest function to move it into
                            let nearestFunction = null;
                            let minDistance = Infinity;
                            
                            for (const block of functionBlocks) {
                                const distance = Math.min(
                                    Math.abs(i - block.start),
                                    Math.abs(i - block.end)
                                );
                                
                                if (distance < minDistance) {
                                    minDistance = distance;
                                    nearestFunction = block;
                                }
                            }
                            
                            if (nearestFunction) {
                                // Move the return statement inside the function, right before it ends
                                const returnLine = lines[i];
                                lines.splice(i, 1); // Remove the original return
                                lines.splice(nearestFunction.end, 0, returnLine); // Add before function end
                                
                                diagnostics.push(`Moved return statement into function: ${nearestFunction.name}`);
                                
                                // Update indices since we moved lines
                                if (i < nearestFunction.end) {
                                    nearestFunction.end--;
                                }
                                i--; // Reprocess the current line index since we removed a line
                            }
                        }
                    }
                }
                
                fixedCode = lines.join('\n');
            } else if (language === 'python') {
                // Python-specific validations
                const lines = fixedCode.split('\n');
                
                // Track function definitions and their indentation
                const functionBlocks = [];
                let currentFunction = null;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const indentation = line.match(/^\s*/)[0].length;
                    
                    // Check for function definitions
                    const defMatch = line.match(/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
                    if (defMatch) {
                        currentFunction = {
                            name: defMatch[1],
                            startLine: i,
                            indentation: indentation,
                            endLine: null
                        };
                        functionBlocks.push(currentFunction);
                    } 
                    // If line is less indented than the current function, we've exited the function
                    else if (currentFunction && indentation <= currentFunction.indentation && line.trim() !== '') {
                        currentFunction.endLine = i - 1;
                        currentFunction = null;
                    }
                }
                
                // Set end line for any function that reaches the end of the file
                if (currentFunction && currentFunction.endLine === null) {
                    currentFunction.endLine = lines.length - 1;
                }
                
                // Check for return statements outside function scope
                for (let i = 0; i < lines.length; i++) {
                    if (/^\s*return\s/.test(lines[i])) {
                        let insideFunction = false;
                        let containingFunction = null;
                        
                        for (const func of functionBlocks) {
                            if (i >= func.startLine && (func.endLine === null || i <= func.endLine)) {
                                insideFunction = true;
                                containingFunction = func;
                                break;
                            }
                        }
                        
                        if (!insideFunction) {
                            // This return is outside a function - try to find the nearest function to move it into
                            let nearestFunction = null;
                            let minDistance = Infinity;
                            
                            for (const func of functionBlocks) {
                                const distance = Math.min(
                                    Math.abs(i - func.startLine),
                                    func.endLine ? Math.abs(i - func.endLine) : Infinity
                                );
                                
                                if (distance < minDistance) {
                                    minDistance = distance;
                                    nearestFunction = func;
                                }
                            }
                            
                            if (nearestFunction) {
                                // Move the return statement inside the function, properly indented
                                const returnLine = lines[i];
                                lines.splice(i, 1); // Remove the original return
                                
                                // Calculate proper indentation for the return statement
                                const properIndentation = ' '.repeat(nearestFunction.indentation + 4);
                                const indentedReturn = properIndentation + returnLine.trim();
                                
                                // Insert at the end of the function
                                lines.splice(nearestFunction.endLine, 0, indentedReturn);
                                
                                diagnostics.push(`Moved return statement into function: ${nearestFunction.name}`);
                                
                                // Update indices since we moved lines
                                if (i < nearestFunction.endLine) {
                                    nearestFunction.endLine--;
                                }
                                i--; // Reprocess the current line index since we removed a line
                            }
                        }
                    }
                }
                
                fixedCode = lines.join('\n');
            }
            
            // 3. Check for incomplete code blocks and add missing closing brackets/braces
            if (language === 'javascript' || language === 'typescript') {
                const openBraces = (fixedCode.match(/\{/g) || []).length;
                const closeBraces = (fixedCode.match(/\}/g) || []).length;
                
                if (openBraces > closeBraces) {
                    // Add missing closing braces
                    fixedCode += '\n' + '}'.repeat(openBraces - closeBraces);
                    diagnostics.push(`Added ${openBraces - closeBraces} missing closing braces`);
                }
            } else if (language === 'python') {
                // For Python, we rely on indentation which is harder to fix automatically
                // But we can check for common syntax issues
                if (fixedCode.includes('else:') && !fixedCode.includes('if ')) {
                    // 'else' without 'if' - try to add a basic if condition
                    fixedCode = fixedCode.replace(/else:/g, 'if True:\n    pass\nelse:');
                    diagnostics.push('Added missing if statement before else');
                }
            }
            
            // 4. Fix common syntax issues with variable access and function calls
            if (language === 'javascript' || language === 'typescript') {
                // Fix missing this references in class methods
                const lines = fixedCode.split('\n');
                let inClass = false;
                let classIndentation = 0;
                let classMembers = new Set();
                
                // First pass: collect class members
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    if (line.startsWith('class ') && line.includes('{')) {
                        inClass = true;
                        classIndentation = lines[i].match(/^\s*/)[0].length;
                        classMembers.clear();
                    } else if (inClass) {
                        const currentIndentation = lines[i].match(/^\s*/)[0].length;
                        if (currentIndentation <= classIndentation && line.length > 0) {
                            inClass = false;
                        } else {
                            // Check for method or property definition
                            const memberMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[\(=]/);
                            if (memberMatch) {
                                classMembers.add(memberMatch[1]);
                            }
                        }
                    }
                }
                
                // Second pass: fix missing this references
                inClass = false;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    if (line.startsWith('class ') && line.includes('{')) {
                        inClass = true;
                        classIndentation = lines[i].match(/^\s*/)[0].length;
                    } else if (inClass) {
                        const currentIndentation = lines[i].match(/^\s*/)[0].length;
                        if (currentIndentation <= classIndentation && line.length > 0) {
                            inClass = false;
                        } else {
                            // Check if line uses class members without 'this.'
                            for (const member of classMembers) {
                                // Exclude the line if it's defining the member
                                if (!line.includes(`${member} =`) && !line.includes(`${member}(`)) {
                                    const beforeFix = lines[i];
                                    // Add 'this.' before member references, avoiding adding to string literals
                                    lines[i] = lines[i].replace(
                                        new RegExp(`\\b${member}\\b(?![\\s]*[:=\\(])`, 'g'), 
                                        `this.${member}`
                                    );
                                    
                                    if (beforeFix !== lines[i]) {
                                        diagnostics.push(`Added missing 'this.' reference to ${member}`);
                                    }
                                }
                            }
                        }
                    }
                }
                
                fixedCode = lines.join('\n');
            }
            
            // If we made changes and diagnostics are enabled, log them
            if (fixedCode !== originalCode && diagnostics.length > 0) {
                console.log('Code validation fixed issues:', diagnostics);
            }
            
            // Return the fixed code
            return fixedCode;
        } catch (e) {
            console.warn('Code validation error:', e);
            // If something goes wrong, return the original code
            return code;
        }
    }

    // New helper to preserve code indentation while escaping HTML
    preserveCodeFormatting(code) {
        return this.escapeHtml(code)
            // Preserve leading spaces by replacing spaces with non-breaking spaces
            .replace(/^ {2,}/gm, match => '&nbsp;'.repeat(match.length));
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