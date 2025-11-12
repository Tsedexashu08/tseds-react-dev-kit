const vscode = require('vscode');

// NOTE: This default URL must point to your running local development server 
// (e.g., React/Next.js/Vite dev server)
const DEFAULT_PREVIEW_URL = 'http://localhost:3000/'; 

/**
 * Manages the WebviewView for the Component Preview panel.
 * It displays a live preview of the application (via an iframe) 
 * and forces a refresh whenever a document is saved.
 */
class ComponentPreviewProvider {
    constructor(extensionContext) {
        this._extensionContext = extensionContext;
        this._view = undefined;
        this._currentPreviewUrl = DEFAULT_PREVIEW_URL;
        this._setEventHandlers();
    }

    /**
     * Set up listeners for saving documents, which triggers a preview refresh.
     */
    _setEventHandlers() {
        // Listener for when any document is saved
        vscode.workspace.onDidSaveTextDocument(this._handleDocumentSave, this, this._extensionContext.subscriptions);

        // Listener for when the active editor changes (optional: to show status)
        vscode.window.onDidChangeActiveTextEditor(this._handleActiveEditorChange, this, this._extensionContext.subscriptions);
    }

    /**
     * Handles document save events. If the saved document is likely a source file 
     * (e.g., .js, .jsx, .ts, .tsx), it forces the webview to reload the preview.
     * @param {vscode.TextDocument} document - The document that was saved.
     */
    _handleDocumentSave(document) {
        // Only refresh if the document looks like a front-end source file
        const fileName = document.fileName;
        if (fileName.endsWith('.jsx') || fileName.endsWith('.tsx') || fileName.endsWith('.js') || fileName.endsWith('.ts') || fileName.endsWith('.css')) {
            this._refreshPreview(`Saved: ${document.fileName.split('/').pop()}`);
        }
    }

    /**
     * Handles active editor change events (e.g., to update the panel title or status).
     * @param {vscode.TextEditor | undefined} editor - The currently active text editor.
     */
    _handleActiveEditorChange(editor) {
        if (!this._view || !editor) {
            return;
        }

        const fileName = editor.document.fileName.split('/').pop();
        
        // Optionally send a message to the webview to update a status bar if you added one
        this._view.webview.postMessage({
            type: 'statusUpdate',
            message: `Currently viewing: ${fileName}`
        });
    }

    /**
     * Sends a message to the webview to force the iframe to reload.
     * @param {string} statusMessage - Message to potentially display in the console or panel.
     */
    _refreshPreview(statusMessage = 'Forcing Reload...') {
        if (this._view && this._view.webview) {
            this._view.webview.postMessage({
                type: 'refresh',
                url: this._currentPreviewUrl, // Pass URL to ensure refresh logic works
            });
            console.log(`[ComponentPreview] ${statusMessage} - Refreshing preview.`);
        }
    }

    /**
     * The main method called by VS Code to resolve the view.
     * @param {vscode.WebviewView} webviewView - The webview instance.
     * @param {vscode.WebviewViewResolveContext} context - Context information.
     * @param {vscode.CancellationToken} token - Cancellation token.
     */
    resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionContext.extensionUri]
        };

        // Set the initial HTML content
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages received from the webview (e.g., user interaction)
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                // You could add a 'changeUrl' message here if the user wants to point to a different port/URL
                case 'changeUrl':
                    this._currentPreviewUrl = data.newUrl;
                    this._refreshPreview('URL Changed');
                    break;
            }
        });
    }

    /**
     * Returns the HTML content for the webview, which includes the iframe 
     * and the JavaScript logic for handling refresh messages.
     * @param {vscode.Webview} webview - The webview instance.
     */
    _getHtmlForWebview(webview) {
        // Use a non-empty string for initial URL
        const initialUrl = this._currentPreviewUrl; 
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Component Preview</title>
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        height: 100vh;
                        overflow: hidden; /* Prevent body scrollbars */
                        background-color: var(--vscode-editor-background);
                    }
                    /* The iframe acts as the "Simple Browser" */
                    #preview-iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                        display: block;
                        background-color: white; /* Important fallback */
                    }
                </style>
            </head>
            <body>
                <iframe id="preview-iframe" src="${initialUrl}"></iframe>

                <script>
                    const vscode = acquireVsCodeApi();
                    const iframe = document.getElementById('preview-iframe');

                    window.addEventListener('message', event => {
                        const message = event.data; 

                        switch (message.type) {
                            case 'refresh':
                                // To ensure a forced refresh, we momentarily set the src to a dummy value 
                                // and then back to the original URL.
                                const currentSrc = iframe.src;
                                iframe.src = 'about:blank'; 
                                
                                // Use a slight delay to ensure the browser registers the change
                                setTimeout(() => {
                                    // If a new URL was passed (optional), use it, otherwise use the current URL.
                                    iframe.src = message.url || currentSrc; 
                                }, 10);
                                
                                console.log('Preview refreshed due to file save.');
                                break;
                            
                            case 'statusUpdate':
                                // Optional: Update a visible status bar in the webview if you add one
                                console.log('Status Update:', message.message);
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}

module.exports = ComponentPreviewProvider;