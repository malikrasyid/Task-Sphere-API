const vscode = require('vscode');

function activate(context) {
    let tasks = [
        { name: 'Task 1', deliverable: 'Report', deadline: new Date('2024-11-20') },
        { name: 'Task 2', deliverable: 'Presentation', deadline: new Date('2024-12-01') }
    ];

    let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'extension.manageTasks';
    context.subscriptions.push(statusBarItem);

    function updateStatusBar() {
        if (tasks.length === 0) {
            statusBarItem.text = 'No tasks available';
        } else {
            const nextTask = tasks.reduce((prev, curr) => (prev.deadline < curr.deadline ? prev : curr));
            statusBarItem.text = `Next: ${nextTask.name} (Due: ${nextTask.deadline.toDateString()})`;
        }
        statusBarItem.show();
    }

    async function addTask() {
        const name = await vscode.window.showInputBox({ prompt: 'Enter task name' });
        if (!name) return;

        const deliverable = await vscode.window.showInputBox({ prompt: 'Enter deliverable' });
        if (!deliverable) return;

        const deadlineInput = await vscode.window.showInputBox({ prompt: 'Enter deadline (YYYY-MM-DD)' });
        if (!deadlineInput || isNaN(new Date(deadlineInput).getTime())) {
            vscode.window.showErrorMessage('Invalid date format.');
            return;
        }
        const deadline = new Date(deadlineInput);

        tasks.push({ name, deliverable, deadline });
        vscode.window.showInformationMessage(`Task "${name}" added successfully.`);
        updateStatusBar();
    }

    function showTasks() {
        if (tasks.length === 0) {
            vscode.window.showInformationMessage('No tasks available.');
        } else {
            vscode.window.showInformationMessage(
                'Tasks:\n' +
                tasks.map(task => `${task.name} (Deliverable: ${task.deliverable}, Due: ${task.deadline.toDateString()})`).join('\n')
            );
        }
    }

    function checkDeadlines() {
        const now = new Date().getTime();
        for (const task of tasks) {
            const timeLeft = task.deadline.getTime() - now;
            if (timeLeft < 0) {
                vscode.window.showWarningMessage(`Task "${task.name}" is overdue!`);
            } else if (timeLeft < 24 * 60 * 60 * 1000) { // 1 day
                vscode.window.showWarningMessage(`Task "${task.name}" is due soon!`);
            }
        }
    }

    function openVisualization() {
        const panel = vscode.window.createWebviewPanel(
            'taskVisualization',
            'Task Visualization',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent(tasks);
    }
    
    function getWebviewContent(tasks) {
        const tasksData = JSON.stringify(tasks);
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Task Visualization</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.6/dayjs.min.js"></script>
                <style>
                    body { font-family: Arial, sans-serif; }
                    #kanban { display: flex; gap: 20px; }
                    .column { flex: 1; padding: 10px; border: 1px solid #ccc; }
                    .column h3 { text-align: center; }
                </style>
            </head>
            <body>
                <h1>Task Visualization</h1>

                <h2>Kanban Board</h2>
                <div id="kanban"></div>

                <h2>Calendar</h2>
                <ul id="calendar"></ul>

                <h2>Gantt Chart</h2>
                <canvas id="gantt"></canvas>

                <script>
                    const tasks = ${tasksData};

                    // Kanban Board
                    const kanban = document.getElementById('kanban');
                    const statuses = ['To Do', 'In Progress', 'Done'];
                    statuses.forEach(status => {
                        const column = document.createElement('div');
                        column.className = 'column';
                        column.innerHTML = '<h3>' + status + '</h3>';
                        tasks.filter(task => task.status === status).forEach(task => {
                            const taskDiv = document.createElement('div');
                            taskDiv.textContent = task.name;
                            column.appendChild(taskDiv);
                        });
                        kanban.appendChild(column);
                    });

                    // Calendar
                    const calendar = document.getElementById('calendar');
                    tasks.forEach(task => {
                        const li = document.createElement('li');
                        li.textContent = task.name + ' (Due: ' + dayjs(task.deadline).format('YYYY-MM-DD') + ')';
                        calendar.appendChild(li);
                    });

                    // Gantt Chart
                    const ctx = document.getElementById('gantt').getContext('2d');
                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: tasks.map(task => task.name),
                            datasets: [{
                                label: 'Days to Deadline',
                                data: tasks.map(task => {
                                    const now = dayjs();
                                    const deadline = dayjs(task.deadline);
                                    return deadline.diff(now, 'day');
                                }),
                                backgroundColor: 'rgba(75, 192, 192, 0.5)'
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            scales: {
                                x: { beginAtZero: true }
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    async function manageTasks() {
        const action = await vscode.window.showQuickPick(
            ['Show Tasks', 'Add Task', 'Check Deadlines', 'Open Visualization'],
            { placeHolder: 'Select an action' }
        );
        if (action === 'Show Tasks') {
            showTasks();
        } else if (action === 'Add Task') {
            addTask();
        } else if (action === 'Check Deadlines') {
            checkDeadlines();
        } else if (action === 'Open Visualization') {
            openVisualization();
        }
    }

    context.subscriptions.push(vscode.commands.registerCommand('extension.manageTasks', manageTasks));

    // Background timer for deadline checks
    const interval = setInterval(checkDeadlines, 60 * 1000); // Check every minute
    context.subscriptions.push({ dispose: () => clearInterval(interval) });

    updateStatusBar();
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
