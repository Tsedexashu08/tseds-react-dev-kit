const vscode = require('vscode');
const path = require('path');

class SidePanelProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'showInfo':
          vscode.window.showInformationMessage(`React Dev Tools: ${data.message}`);
          break;
        case 'insertCode':
          this._insertCode(data.code);
          break;
        case 'runCommand':
          vscode.commands.executeCommand(data.command);
          break;
        case 'analyzeProps':
          this._analyzePropDrilling();
          break;
        case 'fetchAPIData':
          this._simulateAPIData().then(apiData => {
            webviewView.webview.postMessage({
              type: 'apiDataReceived',
              data: apiData
            });
          });
          break;
        case 'fetchSchemaData':
          this._simulateSchemaData().then(schemaData => {
            webviewView.webview.postMessage({
              type: 'schemaDataReceived',
              data: schemaData
            });
          });
          break;
      }
    });
  }

  _getHtmlForWebview(webview) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          :root {
            --primary: var(--vscode-button-background);
            --primary-hover: var(--vscode-button-hoverBackground);
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-panel-background);
            --bg-tertiary: var(--vscode-input-background);
            --text-primary: var(--vscode-editor-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --border: var(--vscode-panel-border);
            --accent: var(--vscode-textLink-foreground);
            --success: #4CAF50;
            --warning: #FF9800;
            --error: #F44336;
            --info: #2196F3;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            padding: 16px;
            background: var(--bg-primary);
            color: var(--text-primary);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
            line-height: 1.4;
          }

          .container {
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-width: 100%;
          }

          .header {
            text-align: center;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border);
          }

          .header h1 {
            font-size: 18px;
            font-weight: 600;
            color: var(--accent);
            margin-bottom: 4px;
          }

          .header .subtitle {
            font-size: 12px;
            color: var(--text-secondary);
          }

          .section {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 6px;
            overflow: hidden;
          }

          .section-header {
            background: var(--bg-tertiary);
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .section-content {
            padding: 12px;
          }

          .btn {
            padding: 8px 12px;
            background: var(--primary);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
          }

          .btn:hover {
            background: var(--primary-hover);
            transform: translateY(-1px);
          }

          .btn-secondary {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-primary);
          }

          .btn-success { background: var(--success); }
          .btn-warning { background: var(--warning); }
          .btn-error { background: var(--error); }
          .btn-info { background: var(--info); }

          .btn-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .input-group {
            margin-bottom: 12px;
          }

          .input-group label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            color: var(--text-secondary);
            font-size: 12px;
          }

          .input-group input, .input-group select {
            width: 100%;
            padding: 8px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            font-size: 12px;
          }

          .code-preview {
            background: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 4px;
            font-family: 'Cascadia Code', 'Fira Code', monospace;
            font-size: 11px;
            line-height: 1.3;
            white-space: pre-wrap;
            border: 1px solid var(--border);
            max-height: 200px;
            overflow-y: auto;
          }

          /* Database Table Styles */
          .database-view {
            background: var(--bg-tertiary);
            border-radius: 6px;
            padding: 12px;
            margin-top: 12px;
          }

          .schema-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .database-table {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .table-header {
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
          }

          .table-header .table-icon {
            font-size: 14px;
          }

          .table-content {
            padding: 8px;
          }

          .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }

          .data-table th {
            background: var(--bg-tertiary);
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid var(--border);
            color: var(--accent);
          }

          .data-table td {
            padding: 6px;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
          }

          .data-table tr:hover {
            background: var(--bg-primary);
          }

          .field-type {
            font-size: 9px;
            color: var(--text-secondary);
            background: var(--bg-tertiary);
            padding: 2px 4px;
            border-radius: 3px;
            margin-left: 4px;
          }

          .field-required {
            color: var(--error);
            font-weight: bold;
          }

          .field-optional {
            color: var(--success);
          }

          .relationship-line {
            position: relative;
            height: 30px;
            margin: 8px 0;
            display: flex;
            align-items: center;
          }

          .relationship-line::before {
            content: '';
            position: absolute;
            left: 20px;
            right: 20px;
            height: 2px;
            background: var(--accent);
            opacity: 0.6;
          }

          .relationship-line::after {
            content: '↕';
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            background: var(--bg-secondary);
            padding: 0 8px;
            color: var(--accent);
            font-size: 12px;
          }

          .foreign-key {
            background: var(--info);
            color: white;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 9px;
            margin-left: 4px;
          }

          .primary-key {
            background: var(--success);
            color: white;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 9px;
            margin-left: 4px;
          }

          .table-relations {
            display: flex;
            justify-content: space-between;
            margin-top: 8px;
            font-size: 10px;
            color: var(--text-secondary);
          }

          .relation-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 6px 8px;
            flex: 1;
            margin: 0 4px;
            text-align: center;
          }

          .relation-type {
            font-weight: 600;
            color: var(--accent);
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-top: 12px;
          }

          .stat-card {
            background: var(--bg-tertiary);
            padding: 8px;
            border-radius: 4px;
            text-align: center;
            border: 1px solid var(--border);
          }

          .stat-value {
            font-size: 16px;
            font-weight: 600;
            color: var(--accent);
          }

          .stat-label {
            font-size: 10px;
            color: var(--text-secondary);
            margin-top: 2px;
          }

          .analysis-result {
            padding: 10px;
            background: var(--bg-tertiary);
            border-radius: 4px;
            border-left: 3px solid var(--warning);
            margin-top: 8px;
            font-size: 11px;
          }

          .hidden {
            display: none;
          }

          .tabs {
            display: flex;
            border-bottom: 1px solid var(--border);
            margin-bottom: 12px;
          }

          .tab {
            padding: 8px 16px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            font-size: 12px;
            font-weight: 500;
          }

          .tab.active {
            border-bottom-color: var(--accent);
            color: var(--accent);
          }

          .tab-content {
            display: none;
          }

          .tab-content.active {
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚛️ React Dev Tools</h1>
            <div class="subtitle">Professional React Development Assistant</div>
          </div>

          <!-- Component Generator Section -->
          <div class="section">
            <div class="section-header">
              🛠️ Component Generator
            </div>
            <div class="section-content">
              <div class="input-group">
                <label for="componentName">Component Name</label>
                <input type="text" id="componentName" placeholder="Enter component name...">
              </div>
              <div class="input-group">
                <label for="componentType">Component Type</label>
                <select id="componentType">
                  <option value="functional">Functional Component</option>
                  <option value="withState">With useState</option>
                  <option value="withEffects">With useEffect</option>
                  <option value="memoized">Memoized Component</option>
                </select>
              </div>
              <button class="btn btn-success" onclick="generateComponent()">
                ⚡ Generate Component
              </button>
              <div class="code-preview" id="componentPreview">
// Generated component will appear here
              </div>
            </div>
          </div>

          <!-- Quick Actions Section -->
          <div class="section">
            <div class="section-header">
              🚀 Quick Actions
            </div>
            <div class="section-content">
              <div class="btn-group">
                <button class="btn" onclick="insertSnippet('useState')">
                  🎣 Insert useState Hook
                </button>
                <button class="btn" onclick="insertSnippet('useEffect')">
                  🔄 Insert useEffect Hook
                </button>
                <button class="btn" onclick="insertSnippet('customHook')">
                  🛠️ Insert Custom Hook Template
                </button>
                <button class="btn btn-warning" onclick="analyzePropDrilling()">
                  🔍 Detect Prop Drilling
                </button>
                <button class="btn" onclick="optimizePerformance()">
                  🚀 Performance Suggestions
                </button>
              </div>
            </div>
          </div>

          <!-- API Data Visualization Section -->
          <div class="section">
            <div class="section-header">
              📊 Data Visualization
            </div>
            <div class="section-content">
              <div class="tabs">
                <div class="tab active" onclick="switchTab('apiTab')">API Response</div>
                <div class="tab" onclick="switchTab('schemaTab')">Database Schema</div>
                <div class="tab" onclick="switchTab('relationsTab')">Data Relations</div>
              </div>

              <div id="apiTab" class="tab-content active">
                <button class="btn btn-info" onclick="fetchAPIData()">
                  📡 Fetch API Data
                </button>
                <div id="apiDataContainer" class="hidden">
                  <div class="database-view">
                    <h4>📋 API Response Data</h4>
                    <div id="apiTablesContainer"></div>
                  </div>
                </div>
              </div>

              <div id="schemaTab" class="tab-content">
                <button class="btn btn-info" onclick="fetchSchemaData()">
                  🗃️ Load Schema
                </button>
                <div id="schemaContainer" class="hidden">
                  <div class="database-view">
                    <h4>🏗️ Database Schema</h4>
                    <div class="schema-container" id="schemaTablesContainer"></div>
                  </div>
                </div>
              </div>

              <div id="relationsTab" class="tab-content">
                <div class="database-view">
                  <h4>🔗 Entity Relationships</h4>
                  <div class="schema-container">
                    <!-- Users Table -->
                    <div class="database-table">
                      <div class="table-header">
                        <span class="table-icon">👥</span>
                        users
                      </div>
                      <div class="table-content">
                        <table class="data-table">
                          <thead>
                            <tr>
                              <th>Field</th>
                              <th>Type</th>
                              <th>Key</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>id <span class="primary-key">PK</span></td>
                              <td>INT <span class="field-type">AUTO_INCREMENT</span></td>
                              <td><span class="field-required">●</span></td>
                            </tr>
                            <tr>
                              <td>name</td>
                              <td>VARCHAR(100)</td>
                              <td><span class="field-required">●</span></td>
                            </tr>
                            <tr>
                              <td>email</td>
                              <td>VARCHAR(255)</td>
                              <td><span class="field-required">●</span></td>
                            </tr>
                            <tr>
                              <td>created_at</td>
                              <td>TIMESTAMP</td>
                              <td><span class="field-required">●</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div class="relationship-line"></div>

                    <!-- Posts Table -->
                    <div class="database-table">
                      <div class="table-header">
                        <span class="table-icon">📝</span>
                        posts
                      </div>
                      <div class="table-content">
                        <table class="data-table">
                          <thead>
                            <tr>
                              <th>Field</th>
                              <th>Type</th>
                              <th>Key</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>id <span class="primary-key">PK</span></td>
                              <td>INT</td>
                              <td><span class="field-required">●</span></td>
                            </tr>
                            <tr>
                              <td>user_id <span class="foreign-key">FK</span></td>
                              <td>INT</td>
                              <td><span class="field-required">●</span></td>
                            </tr>
                            <tr>
                              <td>title</td>
                              <td>VARCHAR(200)</td>
                              <td><span class="field-required">●</span></td>
                            </tr>
                            <tr>
                              <td>content</td>
                              <td>TEXT</td>
                              <td><span class="field-optional">○</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div class="table-relations">
                      <div class="relation-card">
                        <div class="relation-type">One-to-Many</div>
                        <div>users → posts</div>
                      </div>
                      <div class="relation-card">
                        <div class="relation-type">Foreign Key</div>
                        <div>posts.user_id → users.id</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Analysis Results Section -->
          <div class="section">
            <div class="section-header">
              📈 Analysis Results
            </div>
            <div class="section-content">
              <div id="propDrillingResult" class="analysis-result">
                Run "Detect Prop Drilling" to analyze your component tree
              </div>
              <div id="performanceResult" class="analysis-result">
                Performance suggestions will appear here
              </div>
            </div>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          function switchTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(tab => {
              tab.classList.remove('active');
            });
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
              tab.classList.remove('active');
            });
            // Show selected tab
            document.getElementById(tabName).classList.add('active');
            // Activate clicked tab
            event.target.classList.add('active');
          }

          function generateComponent() {
            const name = document.getElementById('componentName').value || 'MyComponent';
            const type = document.getElementById('componentType').value;
            
            let componentCode = '';
            
            switch(type) {
              case 'functional':
                componentCode = \`import React from 'react';

export const \${name} = () => {
  return (
    <div>
      <h1>\${name}</h1>
    </div>
  );
};\`;
                break;
              
              case 'withState':
                componentCode = \`import React, { useState } from 'react';

export const \${name} = () => {
  const [state, setState] = useState('');

  return (
    <div>
      <h1>\${name}</h1>
      <p>Current state: {state}</p>
    </div>
  );
};\`;
                break;
              
              case 'withEffects':
                componentCode = \`import React, { useState, useEffect } from 'react';

export const \${name} = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Fetch data or perform side effects
    console.log('Component mounted');
  }, []);

  return (
    <div>
      <h1>\${name}</h1>
      {data && <p>Data loaded</p>}
    </div>
  );
};\`;
                break;
              
              case 'memoized':
                componentCode = \`import React, { memo } from 'react';

export const \${name} = memo(({ prop1, prop2 }) => {
  return (
    <div>
      <h1>\${name}</h1>
      <p>Prop1: {prop1}</p>
      <p>Prop2: {prop2}</p>
    </div>
  );
});\`;
                break;
            }
            
            document.getElementById('componentPreview').textContent = componentCode;
            
            vscode.postMessage({
              type: 'insertCode',
              code: componentCode
            });
          }

          function insertSnippet(type) {
            let snippet = '';
            
            switch(type) {
              case 'useState':
                snippet = \`const [state, setState] = useState(initialValue);\`;
                break;
              case 'useEffect':
                snippet = \`useEffect(() => {
  // Side effect logic here
}, [dependencies]);\`;
                break;
              case 'customHook':
                snippet = \`const useCustomHook = (initialValue) => {
  const [value, setValue] = useState(initialValue);
  
  const updateValue = (newValue) => {
    setValue(newValue);
  };

  return [value, updateValue];
};\`;
                break;
            }
            
            vscode.postMessage({
              type: 'insertCode',
              code: snippet
            });
          }

          function analyzePropDrilling() {
            vscode.postMessage({
              type: 'analyzeProps'
            });
            
            document.getElementById('propDrillingResult').innerHTML = \`
              <strong>🔍 Prop Drilling Analysis</strong><br>
              Found 3 components with potential prop drilling<br>
              ✅ 2 components can be optimized with Context API<br>
              💡 Consider using React Context or Composition
            \`;
          }

          function optimizePerformance() {
            document.getElementById('performanceResult').innerHTML = \`
              <strong>🚀 Performance Suggestions</strong><br>
              ✅ Use React.memo for expensive components<br>
              🔄 Implement useCallback for event handlers<br>
              📦 Consider code splitting for large bundles<br>
              🎯 Use the Profiler in React DevTools
            \`;
          }

          function fetchAPIData() {
            vscode.postMessage({
              type: 'fetchAPIData'
            });
          }

          function fetchSchemaData() {
            vscode.postMessage({
              type: 'fetchSchemaData'
            });
          }

          function renderAPIData(data) {
            const container = document.getElementById('apiDataContainer');
            const tablesContainer = document.getElementById('apiTablesContainer');
            
            container.classList.remove('hidden');
            
            tablesContainer.innerHTML = \`
              <div class="database-table">
                <div class="table-header">
                  <span class="table-icon">📊</span>
                  API Response Summary
                </div>
                <div class="table-content">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Total Records</td>
                        <td>\${data.totalRecords}</td>
                        <td><span style="color: var(--success)">●</span> OK</td>
                      </tr>
                      <tr>
                        <td>Response Time</td>
                        <td>\${data.responseTime}ms</td>
                        <td><span style="color: var(--success)">●</span> Fast</td>
                      </tr>
                      <tr>
                        <td>Data Size</td>
                        <td>\${data.dataSize} KB</td>
                        <td><span style="color: var(--warning)">●</span> Medium</td>
                      </tr>
                      <tr>
                        <td>Cache Status</td>
                        <td>\${data.cacheStatus}</td>
                        <td><span style="color: var(--success)">●</span> Hit</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="database-table" style="margin-top: 16px;">
                <div class="table-header">
                  <span class="table-icon">👥</span>
                  Users Data
                </div>
                <div class="table-content">
                  <table class="data-table">
                    <thead>
                      <tr>
                        \${Object.keys(data.users[0]).map(key => \`<th>\${key}</th>\`).join('')}
                      </tr>
                    </thead>
                    <tbody>
                      \${data.users.map(user => \`
                        <tr>
                          \${Object.values(user).map(value => \`<td>\${value}</td>\`).join('')}
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            \`;
          }

          function renderSchemaData(data) {
            const container = document.getElementById('schemaContainer');
            const tablesContainer = document.getElementById('schemaTablesContainer');
            
            container.classList.remove('hidden');
            
            tablesContainer.innerHTML = data.tables.map(table => \`
              <div class="database-table">
                <div class="table-header">
                  <span class="table-icon">\${table.icon}</span>
                  \${table.name}
                </div>
                <div class="table-content">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Constraints</th>
                      </tr>
                    </thead>
                    <tbody>
                      \${table.fields.map(field => \`
                        <tr>
                          <td>
                            \${field.name}
                            \${field.isPrimary ? '<span class="primary-key">PK</span>' : ''}
                            \${field.isForeign ? '<span class="foreign-key">FK</span>' : ''}
                          </td>
                          <td>\${field.type} \${field.length ? \`(\${field.length})\` : ''}</td>
                          <td>
                            \${field.required ? '<span class="field-required">●</span>' : '<span class="field-optional">○</span>'}
                            \${field.unique ? 'UNIQUE' : ''}
                          </td>
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            \`).join('');
          }

          // Handle messages from extension
          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
              case 'apiDataReceived':
                renderAPIData(message.data);
                break;
              case 'schemaDataReceived':
                renderSchemaData(message.data);
                break;
            }
          });

          // Initialize
          document.getElementById('componentName').focus();
        </script>
      </body>
      </html>
    `;
  }

  _insertCode(code) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, code);
      });
    } else {
      vscode.window.showWarningMessage('No active editor found to insert code');
    }
  }

  async _analyzePropDrilling() {
    vscode.window.showInformationMessage('Analyzing component tree for prop drilling...');
  }

  async _simulateAPIData() {
    return {
      totalRecords: 5,
      responseTime: 120,
      dataSize: 2.4,
      cacheStatus: 'HIT',
      users: [
        { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active', role: 'User' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Active', role: 'Admin' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Inactive', role: 'User' },
        { id: 4, name: 'Alice Brown', email: 'alice@example.com', status: 'Active', role: 'Moderator' },
        { id: 5, name: 'Mike Wilson', email: 'mike@example.com', status: 'Pending', role: 'User' }
      ]
    };
  }

  async _simulateSchemaData() {
    return {
      tables: [
        {
          name: 'users',
          icon: '👥',
          fields: [
            { name: 'id', type: 'INT', length: 11, required: true, unique: true, isPrimary: true },
            { name: 'username', type: 'VARCHAR', length: 50, required: true, unique: true },
            { name: 'email', type: 'VARCHAR', length: 255, required: true, unique: true },
            { name: 'created_at', type: 'TIMESTAMP', required: true },
            { name: 'updated_at', type: 'TIMESTAMP', required: false }
          ]
        },
        {
          name: 'posts',
          icon: '📝',
          fields: [
            { name: 'id', type: 'INT', length: 11, required: true, unique: true, isPrimary: true },
            { name: 'user_id', type: 'INT', length: 11, required: true, isForeign: true },
            { name: 'title', type: 'VARCHAR', length: 200, required: true },
            { name: 'content', type: 'TEXT', required: false },
            { name: 'published', type: 'BOOLEAN', required: true }
          ]
        }
      ]
    };
  }
}

module.exports = SidePanelProvider;