const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let tasks = [
    {
        name: "Complete Project Proposal",
        deliverable: "Proposal Document",
        startDate: "2024-11-26T09:00:00",
        endDate: "2024-11-30T17:00:00",
        status: "Ongoing"
    },
    {
        name: "Team Meeting",
        deliverable: "Meeting Notes",
        startDate: "2024-11-27T14:00:00",
        endDate: "2024-11-27T15:30:00",
        status: "Done"
    },
    {
        name: "Develop Backend API",
        deliverable: "API Endpoints",
        startDate: "2024-12-01T08:00:00",
        endDate: "2024-12-10T18:00:00",
        status: "Ongoing"
    },
    {
        name: "UI Design Review",
        deliverable: "Updated Wireframes",
        startDate: "2024-12-05T10:00:00",
        endDate: "2024-12-06T12:00:00",
        status: "Not Started"
    },
    {
        name: "Code Testing",
        deliverable: "Test Cases Report",
        startDate: "2024-12-07T09:00:00",
        endDate: "2024-12-09T17:00:00",
        status: "Not Started"
    },
    {
        name: "Final Deployment",
        deliverable: "Live Application",
        startDate: "2024-12-15T13:00:00",
        endDate: "2024-12-16T15:00:00",
        status: "Not Started"
    }
];

/**
 * Fungsi utama untuk mengaktifkan ekstensi.
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.taskManager', () => {
            // Membuat panel Webview
            const panel = vscode.window.createWebviewPanel(
                'taskManager', 
                'Task Manager', 
                vscode.ViewColumn.One, 
                {
                    enableScripts: true, // Izinkan eksekusi skrip
                }
            );

            // Baca file index.html untuk Webview
            const htmlPath = path.join(context.extensionPath, 'index.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            panel.webview.html = htmlContent;

            // Komunikasi antara Webview dan Extension
            panel.webview.onDidReceiveMessage(
                (message) => {
                    switch (message.command) {
                        case 'getTasks':
                            // Kirim data tugas ke Webview
                            panel.webview.postMessage({ command: 'loadTasks', tasks });
                            break;
                        case 'updateTasks':
                            // Perbarui daftar tugas dari Webview
                            tasks = message.tasks;
                            vscode.window.showInformationMessage('Tasks updated successfully!');
                            break;
                        case 'logMessage':
                            vscode.window.showInformationMessage(message.text);
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );
        })
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
