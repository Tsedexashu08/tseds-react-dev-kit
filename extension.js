const vscode = require("vscode");
const SidePanelProvider = require("./src/webview/sidePanelProvider");

function activate(context) {
  console.log(
    'Congratulations, your extension "tsed-s-react-dev-kit" is now active!'
  );

  // Register the side panel webview
  const provider = new SidePanelProvider(context.extensionUri);

  const sidePanelRegistration = vscode.window.registerWebviewViewProvider(
    "tsedSidePanel",
    provider
  );

 // The original hello world command (for testing, I'll take out later...)
const disposable = vscode.commands.registerCommand(
    "tsed-s-react-dev-kit.helloWorld",
    function () {
        const url = 'https://react.dev';

        // 1. Execute the Simple Browser command first. 
        // We must WAIT for this Promise to resolve to ensure the browser is open and active.
        vscode.commands.executeCommand('simpleBrowser.show', url)
            .then(() => {
                // 2. ONLY THEN, execute the command to move the active editor (the Simple Browser)
                // to the next group, creating the side-by-side view.
                return vscode.commands.executeCommand('workbench.action.moveEditorToNextGroup');
            })
            .then(() => {
                // Optional: Show a message upon successful completion
                vscode.window.showInformationMessage('React documentation opened in split view!');
            })
            // .catch(error => {
            //     // Handle any error during the sequence
            //     vscode.window.showErrorMessage(`Failed to open browser: ${error}`);
            // });
    }
);

  // Command to focus on the side panel
  const openPanelCommand = vscode.commands.registerCommand(
    "tsed-s-react-dev-kit.openSidePanel",
    function () {
      vscode.commands.executeCommand("tsedSidePanel.focus");
    }
  );

  context.subscriptions.push(
    disposable,
    openPanelCommand,
    sidePanelRegistration
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};