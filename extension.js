const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let tasks = [
    {
        name: "Complete Project Proposal",
        deliverable: "Proposal Document",
        startDate: "2024-11-26",
        endDate: "2024-11-30",
        status: "Ongoing"
    },
    {
        name: "Team Meeting",
        deliverable: "Meeting Notes",
        startDate: "2024-11-27",
        endDate: "2024-11-27",
        status: "Done"
    },
    {
        name: "Develop Backend API",
        deliverable: "API Endpoints",
        startDate: "2024-12-01",
        endDate: "2024-12-10",
        status: "Ongoing"
    },
    {
        name: "UI Design Review",
        deliverable: "Updated Wireframes",
        startDate: "2024-12-05",
        endDate: "2024-12-06",
        status: "Not Started"
    },
    {
        name: "Code Testing",
        deliverable: "Test Cases Report",
        startDate: "2024-12-07",
        endDate: "2024-12-09",
        status: "Not Started"
    },
    {
        name: "Final Deployment",
        deliverable: "Live Application",
        startDate: "2024-12-15",
        endDate: "2024-12-16",
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
