const vscode = require('vscode');
const SidePanelProvider = require('./src/webview/sidePanelProvider');

function activate(context) {
  console.log('Congratulations, your extension "tsed-s-react-dev-kit" is now active!');

  // Register the side panel webview
  const provider = new SidePanelProvider(context.extensionUri);
  
  const sidePanelRegistration = vscode.window.registerWebviewViewProvider(
    'tsedSidePanel',
    provider
  );

  // The original hello world command
  const disposable = vscode.commands.registerCommand('tsed-s-react-dev-kit.helloWorld', function () {
    vscode.window.showInformationMessage('Tseds React Dev Kit says Hello!');
  });

  // Command to focus on the side panel
  const openPanelCommand = vscode.commands.registerCommand('tsed-s-react-dev-kit.openSidePanel', function () {
    vscode.commands.executeCommand('tsedSidePanel.focus');
  });

  context.subscriptions.push(disposable, openPanelCommand, sidePanelRegistration);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}