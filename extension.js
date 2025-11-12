const vscode = require("vscode");
const SidePanelProvider = require("./src/webview/sidePanelProvider");
const ComponentPreview = require("./src/webview/ComponentPreview");

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
      const url = "https://react.dev";

      // 1. Execute the Simple Browser command first.
      // We must WAIT for this Promise to resolve to ensure the browser is open and active.
      vscode.commands
        .executeCommand("simpleBrowser.show", url)
        .then(() => {
          // 2. ONLY THEN, execute the command to move the active editor (the Simple Browser)
          // to the next group, creating the side-by-side view.
          return vscode.commands.executeCommand(
            "workbench.action.moveEditorToNextGroup"
          );
        })
        .then(() => {
          // Optional: Show a message upon successful completion
          vscode.window.showInformationMessage(
            "React documentation opened in split view!"
          );
        });
    }
  );
  const CptView = vscode.commands.registerCommand(
    "tsed-s-react-dev-kit.OpenComponentPreview",
    async function () {
      const url = "http://localhost:3000/";

      // Check if server is running before opening preview
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        // Server is running, proceed with opening preview
        vscode.commands
          .executeCommand("simpleBrowser.show", url)
          .then(() => {
            return vscode.commands.executeCommand(
              "workbench.action.moveEditorToNextGroup"
            );
          })
          .then(() => {
            vscode.window.showInformationMessage(
              "⚡ Development server preview open in split view!"
            );
          });

      } catch (error) {
        vscode.window.showErrorMessage(
          "Development server is not running. Please start the server first."
        );
      }
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
    sidePanelRegistration,
    CptView
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
