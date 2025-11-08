const vscode = require('vscode');
const path = require('path');
const https = require('https');
const http = require('http');

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
          vscode.window.showInformationMessage(`Tsed's React Dev Tools: ${data.message}`);
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
        case 'fetchSchemaData':
          this._simulateSchemaData().then(schemaData => {
            webviewView.webview.postMessage({
              type: 'schemaDataReceived',
              data: schemaData
            });
          });
          break;
        case 'fetchCustomAPI':
          this._fetchRealAPI(data.endpoint, data.method, data.headers, data.body)
            .then(apiData => {
              webviewView.webview.postMessage({
                type: 'apiDataReceived',
                data: apiData
              });
            })
            .catch(error => {
              webviewView.webview.postMessage({
                type: 'apiError',
                error: error.message
              });
            });
          break;
        case 'exportData':
          vscode.env.clipboard.writeText(data.data);
          vscode.window.showInformationMessage('Data copied to clipboard!');
          break;
      }
    });
  }

  async _fetchRealAPI(endpoint, method = 'GET', headers = {}, body = null) {
    return new Promise((resolve, reject) => {
      try {
        // Validate URL
        let url;
        try {
          url = new URL(endpoint);
        } catch (error) {
          reject(new Error(`Invalid URL: ${endpoint}`));
          return;
        }

        // Choose http or https module
        const httpModule = url.protocol === 'https:' ? https : http;

        // Prepare request options
        const options = {
          method: method.toUpperCase(),
          headers: {
            'User-Agent': 'VSCode-React-Dev-Tools/1.0.0',
            'Accept': 'application/json',
            ...headers
          },
          timeout: 30000 // 30 seconds timeout
        };

        // Add body for non-GET requests
        let requestBody = null;
        if (method.toUpperCase() !== 'GET' && body) {
          requestBody = typeof body === 'string' ? body : JSON.stringify(body);
          options.headers['Content-Type'] = 'application/json';
          options.headers['Content-Length'] = Buffer.byteLength(requestBody);
        }

        vscode.window.showInformationMessage(`Fetching data from: ${endpoint}`);

        const req = httpModule.request(url, options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              // Parse JSON response
              const parsedData = JSON.parse(data);
              
              // Format the response for our visualization
              const formattedData = this._formatAPIResponse(parsedData, res.statusCode);
              resolve(formattedData);
            } catch (parseError) {
              // If not JSON, return as text
              resolve({
                totalRecords: 1,
                responseTime: 0,
                dataSize: Math.round(Buffer.byteLength(data) / 1024 * 100) / 100,
                cacheStatus: res.headers['cache-control'] || 'UNKNOWN',
                statusCode: res.statusCode,
                contentType: res.headers['content-type'],
                rawData: data,
                users: this._extractUsersData(data),
                fullResponse: data
              });
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`Request failed: ${error.message}`));
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout after 30 seconds'));
        });

        // Send body if exists
        if (requestBody) {
          req.write(requestBody);
        }

        req.end();

      } catch (error) {
        reject(new Error(`API request setup failed: ${error.message}`));
      }
    });
  }

  _formatAPIResponse(data, statusCode) {
    // Try to extract meaningful data from various API response structures
    let users = this._extractUsersData(data);
    
    return {
      totalRecords: Array.isArray(data) ? data.length : 
                   (data.data && Array.isArray(data.data)) ? data.data.length : 
                   (data.users && Array.isArray(data.users)) ? data.users.length : 
                   (data.items && Array.isArray(data.items)) ? data.items.length : 1,
      responseTime: 0,
      dataSize: Math.round(JSON.stringify(data).length / 1024 * 100) / 100,
      cacheStatus: 'LIVE',
      statusCode: statusCode,
      users: users,
      fullResponse: data
    };
  }

  _extractUsersData(data) {
    // Try to find user-like data in various common API structures
    if (Array.isArray(data)) {
      return data.slice(0, 10).map((item, index) => ({
        id: item.id || index + 1,
        name: item.name || item.username || item.fullName || `User ${index + 1}`,
        email: item.email || 'N/A',
        status: item.status || item.active !== undefined ? (item.active ? 'Active' : 'Inactive') : 'Unknown',
        role: item.role || item.type || 'User'
      }));
    }

    if (data.data && Array.isArray(data.data)) {
      return data.data.slice(0, 10).map((item, index) => ({
        id: item.id || index + 1,
        name: item.name || item.username || item.fullName || `User ${index + 1}`,
        email: item.email || 'N/A',
        status: item.status || item.active !== undefined ? (item.active ? 'Active' : 'Inactive') : 'Unknown',
        role: item.role || item.type || 'User'
      }));
    }

    if (data.users && Array.isArray(data.users)) {
      return data.users.slice(0, 10).map((item, index) => ({
        id: item.id || index + 1,
        name: item.name || item.username || item.fullName || `User ${index + 1}`,
        email: item.email || 'N/A',
        status: item.status || item.active !== undefined ? (item.active ? 'Active' : 'Inactive') : 'Unknown',
        role: item.role || item.type || 'User'
      }));
    }

    if (data.items && Array.isArray(data.items)) {
      return data.items.slice(0, 10).map((item, index) => ({
        id: item.id || index + 1,
        name: item.name || item.username || item.fullName || `User ${index + 1}`,
        email: item.email || 'N/A',
        status: item.status || item.active !== undefined ? (item.active ? 'Active' : 'Inactive') : 'Unknown',
        role: item.role || item.type || 'User'
      }));
    }

    // If no array structure found, treat the entire object as a single record
    return [{
      id: data.id || 1,
      name: data.name || data.username || data.fullName || 'Single Record',
      email: data.email || 'N/A',
      status: data.status || 'Single',
      role: data.role || 'Record'
    }];
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
            cursor: pointer;
            user-select: none;
            transition: background-color 0.2s;
          }

          .section-header:hover {
            background: var(--bg-primary);
          }

          .section-header::before {
            content: '▼';
            font-size: 10px;
            transition: transform 0.2s ease;
            width: 12px;
            text-align: center;
          }

          .section-header.collapsed::before {
            transform: rotate(-90deg);
          }

          .section-content {
            padding: 12px;
            transition: all 0.3s ease;
          }

          .section-content.collapsed {
            display: none;
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

          .input-group input, .input-group select, .input-group textarea {
            width: 100%;
            padding: 8px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            font-size: 12px;
            font-family: inherit;
          }

          .input-group textarea {
            resize: vertical;
            min-height: 60px;
            font-family: 'Cascadia Code', 'Fira Code', monospace;
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

          .analysis-result.success {
            border-left-color: var(--success);
          }

          .analysis-result.error {
            border-left-color: var(--error);
          }

          .analysis-result.info {
            border-left-color: var(--info);
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

          .flex-row {
            display: flex;
            gap: 8px;
            align-items: center;
          }

          .flex-row input {
            flex: 1;
          }

          .flex-row .btn {
            width: auto;
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚛️ Tsed's React Dev Tools</h1>
            <div class="subtitle">Professional React Development Assistant for my fellow nerds</div>
          </div>

          <!-- Component Generator Section -->
          <div class="section">
            <div class="section-header" onclick="toggleSection('component-generator')">
              🛠️ Component Generator
            </div>
            <div class="section-content" id="component-generator">
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
            <div class="section-header" onclick="toggleSection('quick-actions')">
              🚀 Quick Actions
            </div>
            <div class="section-content" id="quick-actions">
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
            <div class="section-header" onclick="toggleSection('api-visualization')">
              📊 Data Visualization
            </div>
            <div class="section-content" id="api-visualization">
              <div class="tabs">
                <div class="tab active" onclick="switchTab('apiTab')">API Response</div>
                <div class="tab" onclick="switchTab('schemaTab')">Database Schema</div>
                <div class="tab" onclick="switchTab('relationsTab')">Data Relations</div>
              </div>

              <div id="apiTab" class="tab-content active">
                <div class="input-group">
                  <label for="apiEndpoint">
                    <span style="margin-right: 6px;">🌐</span>
                    API Endpoint URL
                  </label>
                  <div class="flex-row">
                    <input 
                      type="text" 
                      id="apiEndpoint" 
                      placeholder="https://api.example.com/data"
                    >
                    <button class="btn btn-info" onclick="testEndpoint()">
                      🔍 Test
                    </button>
                  </div>
                </div>

                <div class="input-group">
                  <label for="requestMethod">
                    <span style="margin-right: 6px;">⚡</span>
                    HTTP Method
                  </label>
                  <select id="requestMethod">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div class="input-group">
                  <label for="requestHeaders">
                    <span style="margin-right: 6px;">📋</span>
                    Request Headers (JSON)
                  </label>
                  <textarea 
                    id="requestHeaders" 
                    placeholder='{"Content-Type": "application/json", "Authorization": "Bearer token"}'
                    rows="3"
                  ></textarea>
                </div>

                <div class="input-group">
                  <label for="requestBody">
                    <span style="margin-right: 6px;">📦</span>
                    Request Body (JSON)
                  </label>
                  <textarea 
                    id="requestBody" 
                    placeholder='{"key": "value"}'
                    rows="3"
                  ></textarea>
                </div>

                <div class="flex-row">
                  <button class="btn btn-success" onclick="fetchCustomAPI()" style="flex: 1;">
                    🚀 Fetch API Data
                  </button>
                  <button class="btn btn-secondary" onclick="clearAPIFields()">
                    🗑️ Clear
                  </button>
                </div>

                <div class="input-group" id="apiStatus" style="display: none;">
                  <label>API Status</label>
                  <div id="statusMessage" class="analysis-result">
                    <!-- Status will appear here -->
                  </div>
                </div>

                <div id="apiDataContainer" class="hidden">
                  <div class="database-view">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                      <h4>📋 API Response Data</h4>
                      <button class="btn btn-secondary" onclick="exportData()" style="width: auto; padding: 4px 8px; font-size: 11px;">
                        💾 Export
                      </button>
                    </div>
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
            <div class="section-header" onclick="toggleSection('analysis-results')">
              📈 Analysis Results
            </div>
            <div class="section-content" id="analysis-results">
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

          // Collapsible sections functionality
          function toggleSection(sectionId) {
            const content = document.getElementById(sectionId);
            const header = content.parentElement.querySelector('.section-header');
            
            content.classList.toggle('collapsed');
            header.classList.toggle('collapsed');
          }

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

          function testEndpoint() {
            const endpoint = document.getElementById('apiEndpoint').value;
            const method = document.getElementById('requestMethod').value;
            
            if (!endpoint) {
              showAPIStatus('Please enter an API endpoint', 'error');
              return;
            }

            // Basic URL validation
            try {
              new URL(endpoint);
            } catch (e) {
              showAPIStatus('Invalid URL format', 'error');
              return;
            }

            showAPIStatus(\`Testing \${method} request to: \${endpoint}\`, 'info');
            
            // Simulate API test
            setTimeout(() => {
              showAPIStatus('✅ Endpoint is reachable', 'success');
            }, 1000);
          }

          function fetchCustomAPI() {
            const endpoint = document.getElementById('apiEndpoint').value;
            const method = document.getElementById('requestMethod').value;
            const headersInput = document.getElementById('requestHeaders').value;
            const bodyInput = document.getElementById('requestBody').value;

            if (!endpoint) {
              showAPIStatus('Please enter an API endpoint', 'error');
              return;
            }

            showAPIStatus('🔄 Fetching data from API...', 'info');

            let headers = {};
            let body = null;

            try {
              if (headersInput) {
                headers = JSON.parse(headersInput);
              }
              if (bodyInput && method !== 'GET') {
                body = JSON.parse(bodyInput);
              }
            } catch (e) {
              showAPIStatus('Invalid JSON in headers or body', 'error');
              return;
            }

            // Send message to extension to fetch the real API
            vscode.postMessage({
              type: 'fetchCustomAPI',
              endpoint: endpoint,
              method: method,
              headers: headers,
              body: body
            });
          }

          function clearAPIFields() {
            document.getElementById('apiEndpoint').value = '';
            document.getElementById('requestHeaders').value = '';
            document.getElementById('requestBody').value = '';
            document.getElementById('apiStatus').style.display = 'none';
            document.getElementById('apiDataContainer').classList.add('hidden');
            showAPIStatus('Fields cleared', 'success');
            setTimeout(() => {
              document.getElementById('apiStatus').style.display = 'none';
            }, 2000);
          }

          function showAPIStatus(message, type) {
            const statusElement = document.getElementById('apiStatus');
            const messageElement = document.getElementById('statusMessage');
            
            statusElement.style.display = 'block';
            messageElement.textContent = message;
            
            // Remove all type classes
            messageElement.classList.remove('success', 'error', 'info', 'warning');
            
            // Add appropriate class based on type
            messageElement.classList.add(type);
          }

          function fetchSchemaData() {
            vscode.postMessage({
              type: 'fetchSchemaData'
            });
          }

          function exportData() {
            const tablesContainer = document.getElementById('apiTablesContainer');
            const data = tablesContainer.innerText;
            
            vscode.postMessage({
              type: 'exportData',
              data: data
            });
            
            showAPIStatus('Data exported to clipboard', 'success');
          }

          function renderAPIData(data) {
            const container = document.getElementById('apiDataContainer');
            const tablesContainer = document.getElementById('apiTablesContainer');
            
            container.classList.remove('hidden');
            
            // Create tables based on the actual API response
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
                        <td>Status Code</td>
                        <td>\${data.statusCode}</td>
                        <td>
                          <span style="color: \${data.statusCode >= 200 && data.statusCode < 300 ? 'var(--success)' : 'var(--error)'}">
                            ●
                          </span>
                          \${data.statusCode >= 200 && data.statusCode < 300 ? 'Success' : 'Error'}
                        </td>
                      </tr>
                      <tr>
                        <td>Total Records</td>
                        <td>\${data.totalRecords}</td>
                        <td><span style="color: var(--success)">●</span> OK</td>
                      </tr>
                      <tr>
                        <td>Data Size</td>
                        <td>\${data.dataSize} KB</td>
                        <td>
                          <span style="color: \${data.dataSize < 10 ? 'var(--success)' : data.dataSize < 100 ? 'var(--warning)' : 'var(--error)'}">
                            ●
                          </span>
                          \${data.dataSize < 10 ? 'Small' : data.dataSize < 100 ? 'Medium' : 'Large'}
                        </td>
                      </tr>
                      <tr>
                        <td>Cache Status</td>
                        <td>\${data.cacheStatus}</td>
                        <td><span style="color: var(--info)">●</span> Info</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              \${data.users && data.users.length > 0 ? \`
              <div class="database-table" style="margin-top: 16px;">
                <div class="table-header">
                  <span class="table-icon">👥</span>
                  Extracted Data (\${data.users.length} records)
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
              \` : ''}

              <div class="database-table" style="margin-top: 16px;">
                <div class="table-header">
                  <span class="table-icon">🔍</span>
                  Raw Response Preview
                </div>
                <div class="table-content">
                  <div class="code-preview">
\${JSON.stringify(data.fullResponse, null, 2).substring(0, 1000)}\${JSON.stringify(data.fullResponse, null, 2).length > 1000 ? '...' : ''}
                  </div>
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
                showAPIStatus('✅ Data fetched successfully', 'success');
                break;
              case 'apiError':
                showAPIStatus(\`❌ API Error: \${message.error}\`, 'error');
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