const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

let socket;
let panel;
let extensionContext;

/**
 * Fungsi utama untuk mengaktifkan ekstensi VS Code.
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    extensionContext = context;
    connectWebSocket();

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.taskManager', () => {
            if (!panel) {
                panel = createWebviewPanel();
            } else {
                // If panel exists but was closed, create a new one
                if (panel.disposed) {
                    panel = createWebviewPanel();
                } else {
                    // If panel exists and is not closed, just reveal it
                    panel.reveal(vscode.ViewColumn.One);
                }
            }
        })
    );
}

function connectWebSocket() {
    socket = new WebSocket('ws://localhost:8080');
    
    socket.on('open', () => {
        console.log('Connected to WebSocket server');
    });
    
    socket.on('message', (data) => {
        try {
            // Convert the data to string if it's not already
            const dataString = data.toString();
            
            // Parse the string data to JSON
            const message = JSON.parse(dataString);
            
            // Handle different types of updates
            handleDataUpdate(message);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });
    
    socket.on('close', () => {
        console.log('Disconnected from server, attempting to reconnect...');
        setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
    });
    
    socket.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
}

function handleDataUpdate(message) {
    if (!panel || panel.disposed) {
        // Create panel if it doesn't exist or was disposed
        panel = createWebviewPanel();
    }
    
    // Send the updated data to the webview
    panel.webview.postMessage(message);
}

function createWebviewPanel(context) {
    // Create and show panel
    const newPanel = vscode.window.createWebviewPanel(
        'taskManager',
        'Task Manager',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Ambil path file index.html
    const indexPath = path.join(extensionContext.extensionPath, 'report.html');

    // Baca file index.html dan muat ke dalam WebView
    fs.readFile(indexPath, 'utf8', (err, data) => {
        if (err) {
            vscode.window.showErrorMessage('Gagal memuat report.html');
            return;
        }
        newPanel.webview.html = data;
    });
    
    // Handle messages from the webview
    newPanel.webview.onDidReceiveMessage(
        message => {
            // Handle UI interactions here
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(message));
            }
        },
        undefined,
        extensionContext.subscriptions
    );
    
    // Handle panel disposal
    newPanel.onDidDispose(() => {
        // You can handle cleanup here if needed
    }, null, extensionContext.subscriptions);
    
    return newPanel;
}

function deactivate() {
    if (socket) {
        socket.close();
    }
}

module.exports = { 
    activate,
    deactivate
};
