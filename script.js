const API_BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:8080';

document.getElementById('mainSection').classList.add('hidden');
         
let selectedUser = null;
let debounceTimeout;
let websocket;

// Initialize WebSocket connection
function initWebSocket() {
    if (websocket) {
        websocket.close();
    }

    websocket = new WebSocket(WS_URL);
    
    websocket.onopen = () => {
        console.log('WebSocket connection established');
        // Send user ID to identify this connection
        const userId = sessionStorage.getItem('userId');
        if (userId) {
            websocket.send(JSON.stringify({
                type: 'identify',
                userId: userId
            }));
        }
    };
    
    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
            
            // Handle different types of updates
            switch (data.type) {
                case 'project_update':
                    renderProjectsAndTasks();
                    break;
                case 'task_update':
                    if (data.projectId) {
                        renderProjectsAndTasks();
                    }
                    // Also update calendar if tasks were changed
                    if (!document.getElementById('calendarSection').classList.contains('hidden')) {
                        renderCalendar();
                    }
                    break;
                case 'member_update':
                    if (data.projectId) {
                        renderProjectsAndTasks();;
                    }
                    break;
                case 'session_expired':
                    // Handle session expiration
                    handleSessionExpired();
                    break;
                default:
                    console.log('Unknown update type:', data.type);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    };
    
    websocket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        // Try to reconnect after a delay
        setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            initWebSocket();
        }, 5000);
    };
    
    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function toggleAuth() {
    document.getElementById('loginForm').classList.toggle('hidden');
    document.getElementById('signupForm').classList.toggle('hidden');
}

async function login() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value; // Added password field
    
    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            // Store all auth data in sessionStorage with consistent keys
            sessionStorage.setItem("sessionToken", data.token);
            sessionStorage.setItem("userId", data.userId);
            sessionStorage.setItem("userName", data.name);
            sessionStorage.setItem("userEmail", data.email || email);

            alert("Login sukses");
            showMainSection();
            initWebSocket();

            renderProjectsAndTasks();
        } else {
            alert(data.error || "Login failed");
        }
    } catch (error) {
        console.error("Login failed:", error);
        alert("Login failed. Please check your connection and try again.");
    }
}

async function signUp() {
    const firstName = document.getElementById("signupFirstName").value;
    const lastName = document.getElementById("signupLastName").value;
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    if (!firstName || !lastName || !email || !password) {
        alert("Please fill in all required fields");
        return;
    }
    
    if (password.length < 8) {
        alert("Password must be at least 8 characters long");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firstName, lastName, email, password })
        });
        const data = await response.json();
        if (response.ok) {
            sessionStorage.setItem("userId", data.uid);
            sessionStorage.setItem("sessionToken", data.sessionToken);
            sessionStorage.setItem("userEmail", email);
            
            showMainSection();
            initWebSocket();
        } else {
            alert(data.error  || "Signup failed");
        }
    } catch (error) {
        console.error("Signup failed:", error);
    }
}

 function logout() {
    fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sessionStorage.getItem("sessionToken")}`
        }
    }).catch(error => console.error("Logout API call failed:", error));

    if (websocket) {
        websocket.close();
    }
    
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("sessionToken");
    sessionStorage.removeItem("userEmail");

    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('mainSection').classList.add('hidden');
}

function handleSessionExpired() {
    alert("Your session has expired. Please log in again.");
    logout();
}

function showMainSection() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('mainSection').classList.remove('hidden');

    userProfile();
}

async function userProfile() {
    const userName = toTitleCase(await fetchUserById(sessionStorage.getItem("userId")));
    let profileNameElement = document.getElementById("profileName");
    profileNameElement.textContent = userName;
}

function showSection(sectionId) {
    // Sembunyikan semua section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    // Tampilkan section yang dipilih
    document.getElementById(sectionId).classList.remove('hidden');
}

// Dropdown Profile
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');

if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', function () {
        profileDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', function (event) {
        if (!profileBtn.contains(event.target) && !profileDropdown.contains(event.target)) {
            profileDropdown.classList.add('hidden');
        }
    });
}

// Toggle sidebar
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');

if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('-translate-x-full');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth < 1024) { // lg breakpoint
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.add('-translate-x-full');
            }
        }
    });
}

// Initialize calendar when calendar section is shown
document.getElementById('navCalendar').addEventListener('click', function(event) {
    event.preventDefault();
    showSection('calendarSection');
            
    // Short timeout to ensure the calendar element is visible
    setTimeout(() => {
        if (document.getElementById('calendar')) {
            renderCalendar();
        }
    }, 100);
});

async function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // Destroy existing calendar instance if it exists
    if (calendarEl._calendar) {
        calendarEl._calendar.destroy();
    }

    // Add loading indicator
    calendarEl.innerHTML = `
        <div class="flex justify-center items-center p-8">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span class="ml-3 text-gray-600">Loading calendar...</span>
        </div>
    `;

    try {
        const projects = await fetchUserProjects();
        let allEvents = [];

        for (const project of projects) {
            const tasks = await fetchProjectTasks(project.projectId) || [];
                
            const taskEvents = tasks.map(task => ({
                    id: task.taskId,
                    title: `${task.name} (${project.name})`,
                    start: task.startDate,
                    end: task.endDate,
                    backgroundColor: getTaskColor(task.status),
                    borderColor: getTaskColor(task.status),
                    textColor: getContrastColor(getTaskColor(task.status)),
                    extendedProps: {
                        projectName: project.name,
                        status: task.status,
                        deliverable: task.deliverable
                    }
                }));
                allEvents.push(...taskEvents);
            }

            // Clear loading indicator
            calendarEl.innerHTML = '';

            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                },
                events: allEvents,
                themeSystem: 'bootstrap5',
                views: {
                    dayGridMonth: {
                        dayMaxEventRows: 3,
                        dayMaxEvents: true
                    }
                },
                eventTimeFormat: {
                    hour: '2-digit',
                    minute: '2-digit',
                    meridiem: 'short'
                },
                nowIndicator: true,
                eventDidMount: function(info) {
                    const event = info.event;
                    // Add visual indicator for task status
                    const statusDot = document.createElement('span');
                    statusDot.className = 'status-indicator mr-1 inline-block w-2 h-2 rounded-full';
                    statusDot.style.backgroundColor = getTaskColor(event.extendedProps.status);
                    
                    // Add project name as a small tag
                    const projectTag = document.createElement('small');
                    projectTag.className = 'project-tag text-xs px-1 rounded ml-1 opacity-75';
                    projectTag.textContent = event.extendedProps.projectName;
                    projectTag.style.backgroundColor = lightenColor(getTaskColor(event.extendedProps.status), 30);
                    projectTag.style.color = getContrastColor(lightenColor(getTaskColor(event.extendedProps.status), 30));
                    
                    // Only add these elements in month view to avoid cluttering
                    if (info.view.type === 'dayGridMonth') {
                        const titleEl = info.el.querySelector('.fc-event-title');
                        if (titleEl) {
                            titleEl.prepend(statusDot);
                            if (event.title.length < 15) { // Only add project tag if title is short enough
                                titleEl.appendChild(projectTag);
                            }
                        }
                    }
                    
                    // Add tooltip with rich information
                    info.el.title = `
                        ${event.title}
                        Project: ${event.extendedProps.projectName}
                        Status: ${event.extendedProps.status}
                        ${event.extendedProps.deliverable ? 'Deliverable: ' + event.extendedProps.deliverable : ''}
                    `.trim();

                    // Add hover effect
                    info.el.classList.add('transition', 'duration-200');
                    info.el.addEventListener('mouseenter', () => {
                        info.el.style.transform = 'scale(1.02)';
                        info.el.style.zIndex = '5';
                        info.el.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                    });
                    info.el.addEventListener('mouseleave', () => {
                        info.el.style.transform = '';
                        info.el.style.zIndex = '';
                        info.el.style.boxShadow = '';
                    });
                },
                eventClick: function(info) {
                    const event = info.event;
                    const startDate = formatDateUTC(event.start);
                    const endDate = formatDateUTC(event.end || event.start);
                    const duration = calculateDuration(event.start, event.end || event.start);
                    
                    // Get status color
                    const statusColor = getTaskColor(event.extendedProps.status);
                    
                    const details = `
                        <div class="p-0">
                            <div class="bg-gray-50 px-4 py-2 rounded-t-lg border-b flex items-center" style="border-left: 4px solid ${statusColor}">
                                <div class="flex-grow">
                                    <h3 class="font-bold text-lg">${event.title}</h3>
                                    <p class="text-sm text-gray-600">${event.extendedProps.projectName}</p>
                                </div>
                                <span class="px-2 py-1 rounded text-xs font-medium" 
                                    style="background-color: ${statusColor}; color: ${getContrastColor(statusColor)}">
                                    ${event.extendedProps.status}
                                </span>
                            </div>
                            
                            <div class="p-4 space-y-3">
                                <div class="flex items-start">
                                    <div class="flex-shrink-0 mt-1 mr-3">
                                        <svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p class="text-sm font-medium text-gray-900">Timeline</p>
                                        <p class="text-sm text-gray-600">
                                            ${startDate}${endDate !== startDate ? ' to ' + endDate : ''}
                                            ${duration ? `<span class="ml-1 text-xs bg-gray-100 px-1 rounded">${duration}</span>` : ''}
                                        </p>
                                    </div>
                                </div>
                                
                                ${event.extendedProps.deliverable ? `
                                <div class="flex items-start">
                                    <div class="flex-shrink-0 mt-1 mr-3">
                                        <svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p class="text-sm font-medium text-gray-900">Deliverable</p>
                                        <p class="text-sm text-gray-600">${event.extendedProps.deliverable}</p>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                            
                    // Create modal to show task details
                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center animate-fadeIn';
                    modal.innerHTML = `
                        <div class="relative mx-auto p-0 border w-full max-w-md shadow-xl rounded-lg bg-white animate-scaleIn" 
                            style="max-height: 90vh; overflow: auto;">
                            ${details}
                        </div>
                    `;
                            
                    document.body.appendChild(modal);
                            
                    modal.addEventListener('click', function(e) {
                        if (e.target === modal || e.target.textContent === 'Close') {
                            modal.remove();
                        }
                    });
                },
                height: 'auto',
                dayMaxEvents: true,
                // Enhanced styling options
                contentHeight: 'auto',
                aspectRatio: 1.8,
                firstDay: 1, // Start week on Monday
                slotEventOverlap: false,
                displayEventTime: true,
                eventMaxStack: 3,
                dayPopoverFormat: { month: 'long', day: 'numeric', year: 'numeric' }
            });
            calendar.render();
            calendarEl._calendar = calendar;
        
    } catch (error) {
        console.error('Error rendering calendar:', error);
        calendarEl.innerHTML = '<p class="text-red-500 p-4">Error loading calendar. Please try again later.</p>';
    }
}

// Helper function to calculate duration between dates
function calculateDuration(start, end) {
    if (!start || !end) return '';
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffTime / (1000 * 60));
            return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
        }
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else if (diffDays < 30) {
        const diffWeeks = Math.floor(diffDays / 7);
        return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`;
    } else {
        const diffMonths = Math.floor(diffDays / 30);
        return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
    }
}

function getContrastColor(hexColor) {
    // Remove # if present
    if (hexColor.startsWith('#')) {
        hexColor = hexColor.slice(1);
    }
    
    // Convert to RGB
    let r = parseInt(hexColor.substr(0, 2), 16);
    let g = parseInt(hexColor.substr(2, 2), 16);
    let b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calculate luminance
    let luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black for bright colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function lightenColor(hex, percent) {
    // Remove # if present
    if (hex.startsWith('#')) {
        hex = hex.slice(1);
    }
    
    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);
    
    r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
    
    const rr = r.toString(16).padStart(2, '0');
    const gg = g.toString(16).padStart(2, '0');
    const bb = b.toString(16).padStart(2, '0');
    
    return `#${rr}${gg}${bb}`;
}

function showAddTaskModal(projectId) {
    console.log('Showing add task modal for project:', projectId);
    const modal = document.getElementById('addTaskModal');
    if (!modal) {
        console.error('Add Task modal element not found');
        return;
    }
            
    // Reset form and set project ID
    const taskProjectId = document.getElementById('taskProjectId');
    const addTaskForm = document.getElementById('addTaskForm');
            
    if (taskProjectId) taskProjectId.value = projectId;
    if (addTaskForm) addTaskForm.reset();
            
    // Show modal
    modal.classList.remove('hidden');
    console.log('Modal should now be visible');
}

// Function to close add task modal
function closeAddTaskModal() {
    const modal = document.getElementById('addTaskModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function getStatusClass(status) {
    switch(status) {
        case 'Done': return 'bg-green-100 text-green-800';
        case 'Ongoing': return 'bg-blue-100 text-blue-800';
        case 'Overdue': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const projectId = document.getElementById('taskProjectId').value;
    const taskData = {
        taskId: Date.now().toString(), // Simple unique ID generation
        name: document.getElementById('taskName').value,
        deliverable: document.getElementById('taskDeliverable').value,
        startDate: new Date(document.getElementById('taskStartDate').value),
        endDate: new Date(document.getElementById('taskEndDate').value),
        status: 'Not Started'
    };

    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/add-tasks`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem("sessionToken")}`
            },
            body: JSON.stringify(taskData)
        });

        // Check if session expired
        if (response.status === 401) {
            handleSessionExpired();
            return;
        }

        if (response.ok) {
            closeAddTaskModal();
            await renderProjectsAndTasks();
        } else {
            const data = await response.json();
            alert(data.error || 'Error adding task');
        }
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Error adding task');
    }
});
    
function getTaskColor(status) {
    switch(status.toLowerCase()) {
        case 'done':
            return '#10B981'; // green-500
        case 'ongoing':
            return '#3B82F6'; // blue-500
        case 'overdue':
            return '#EF4444'; // red-500
        case 'not started':
        default:
            return '#6B7280'; // gray-500
    }
}

function debounceSearch(value) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        searchUsers(value);
    }, 300);
}

async function searchUsers(query) {
    if (query.length < 2) {
        document.getElementById('searchResults').innerHTML = '<p class="text-gray-500 p-2">Type at least 2 characters to search</p>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/search-users?query=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem("sessionToken")}`
            }
        });
        
        // Check if session expired
        if (response.status === 401) {
            handleSessionExpired();
            return;
        }
        
        if (!response.ok) throw new Error('Search failed');
                
        const data = await response.json();
        renderSearchResults(data.users);
    } catch (error) {
        console.error('Error searching users:', error);
        document.getElementById('searchResults').innerHTML = '<p class="text-red-500 p-2">Error searching users</p>';
    }
}

function renderSearchResults(users) {
    const resultsContainer = document.getElementById('searchResults');
            
    if (!users || users.length === 0) {
        resultsContainer.innerHTML = '<p class="text-gray-500 p-2">No users found</p>';
        return;
    }

     resultsContainer.innerHTML = users.map(user => `
        <div class="p-2 hover:bg-gray-100 cursor-pointer rounded" 
            onclick="selectUser('${user.userId}', '${user.firstName}', '${user.lastName}', '${user.email}')">
            <div class="font-medium">${user.firstName} ${user.lastName}</div>
            <div class="text-sm text-gray-600">${user.email}</div>
        </div>
    `).join('');
}

async function markTaskAsDone(projectId, taskId) {
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/update-task/${taskId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem("sessionToken")}`
            },
            body: JSON.stringify({ status: 'Done' })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update task status');
        }

        // Opsional: refresh tampilan atau fetch ulang data
        alert('Task marked as done!');
        renderProjectsAndTasks();
    } catch (error) {
        console.error('Error marking task as done:', error);
        alert('Failed to mark task as done');
    }
}

function selectUser(userId, firstName, lastName, email) {
    selectedUser = { userId, firstName, lastName, email };
            
    // Show selected user info
    const selectedUserInfo = document.getElementById('selectedUserInfo');
    if (selectedUserInfo) {
        selectedUserInfo.classList.remove('hidden');
        selectedUserInfo.innerHTML = `
            <div class="font-medium">${firstName} ${lastName}</div>
            <div class="text-sm text-gray-600">${email}</div>
        `;
    }

    // Show role selection and add button
    const roleSelection = document.getElementById('roleSelection');
    const addMemberBtn = document.getElementById('addMemberBtn');
    
    if (roleSelection) roleSelection.classList.remove('hidden');
    if (addMemberBtn) addMemberBtn.classList.remove('hidden');
            
    // Clear search results
    const searchResults = document.getElementById('searchResults');
    const userSearchInput = document.getElementById('userSearchInput');
    
    if (searchResults) searchResults.innerHTML = '';
    if (userSearchInput) userSearchInput.value = '';
}

function showAddMemberModal(projectId) {
    console.log('Showing add member modal for project:', projectId);
    const modal = document.getElementById('addMemberModal');
    if (!modal) {
        console.error('Add Member modal element not found');
        return;
    }
            
     // Reset modal state
    const memberProjectId = document.getElementById('memberProjectId');
    const userSearchInput = document.getElementById('userSearchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (memberProjectId) memberProjectId.value = projectId;
    if (userSearchInput) userSearchInput.value = '';
    if (searchResults) searchResults.innerHTML = '';
            
    const selectedUserInfo = document.getElementById('selectedUserInfo');
    const roleSelection = document.getElementById('roleSelection');
    const addMemberBtn = document.getElementById('addMemberBtn');
            
    if (selectedUserInfo) selectedUserInfo.classList.add('hidden');
    if (roleSelection) roleSelection.classList.add('hidden');
    if (addMemberBtn) addMemberBtn.classList.add('hidden');
            
    // Show modal
    modal.classList.remove('hidden');
    console.log('Modal should now be visible');
}

function closeAddMemberModal() {
    const modal = document.getElementById('addMemberModal');
    if (modal) {
        modal.classList.add('hidden');
    }        
}

function formatDateUTC(dateStr) {
    if (!dateStr) return '-';

    const date = new Date(dateStr);
    if (isNaN(date)) return '-';

    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short'
    });
}

async function addMemberToProject() {
    if (!selectedUser) return;

    const projectId = document.getElementById('memberProjectId').value;
    const role = document.getElementById('memberRole').value;

    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/add-member`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem("sessionToken")}`
            },
            body: JSON.stringify({
                userId: selectedUser.userId,
                role: role
            })
        });

        // Check if session expired
        if (response.status === 401) {
            handleSessionExpired();
            return;
        }
        
        if (!response.ok) throw new Error('Failed to add member');

        closeAddMemberModal();
        // Refresh project display
        await renderProjectsAndTasks();
    } catch (error) {
        console.error('Error adding member:', error);
        alert('Failed to add member to project');
    }
}
    
function showCreateProjectModal() {
    document.getElementById('createProjectModal').classList.remove('hidden');
}

function closeCreateProjectModal() {
    document.getElementById('createProjectModal').classList.add('hidden');
    document.getElementById('projectForm').reset();
}

async function deleteTask(projectId, taskId) {
    const token = sessionStorage.getItem("sessionToken");
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/delete-task/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Deleting task from project:', projectId, taskId);

        if (response.ok) {
            alert('Task deleted successfully');
            await renderProjectsAndTasks();
        } else {
            const data = await response.json();
            alert('Error deleting task: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to delete task.');
    }
}

async function deleteProject(projectId) {
    const token = sessionStorage.getItem("sessionToken");
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Deleting project:', projectId);


        if (response.ok) {
            alert('Project deleted successfully');
            await renderProjectsAndTasks();
        } else {
            const data = await response.json();
            alert('Error deleting project: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to delete project.');
    }
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, txt =>
        txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );
}

async function fetchUserProjects() {
    const token = sessionStorage.getItem("sessionToken"); // Simpan token login di sessionStorage saat login
    
    try {
        const response = await fetch(`${API_BASE_URL}/user-projects`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            handleSessionExpired();
            return;
        }

        if (!response.ok) {
            const text = await response.text(); // karena mungkin bukan JSON
            console.error('Server responded with error:', response.status, text);
            return;
        }

        const data = await response.json();
        return data.projects;
    } catch (error) {
        console.error('Error fetching projects:', error);
    }
}

async function fetchProjectTasks(projectId) {
    const token = sessionStorage.getItem("sessionToken");

    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/tasks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            handleSessionExpired();
            return;
        }

        const data = await response.json();

        const tasksWithStringDates = data.tasks.map(task => ({
            ...task,
            startDate: task.startDate ? new Date(task.startDate._seconds * 1000).toISOString() : null,
            endDate: task.endDate ? new Date(task.endDate._seconds * 1000).toISOString() : null
        }));
        
        return tasksWithStringDates;
    } catch (error) {
        console.error('Error fetching tasks:', error);
    }
}

async function fetchTaskComments(projectId, taskId) {
    const token = sessionStorage.getItem("sessionToken");

    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/tasks/${taskId}/comments`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch comments');
        }
        
        const data = await response.json();
        return data.comments;
    } catch (error) {
        console.error('Error fetching comments:', error);
        showToast('error', 'Failed to load comments');
        return [];
    }
}

async function addComment(projectId, taskId) {
    const token = sessionStorage.getItem("sessionToken");
    const inputElement = document.getElementById(`comment-input-${taskId}`);
    const message = inputElement.value.trim();
    
    if (!message) {
        showToast('error', 'Comment cannot be empty');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add comment');
        }
        
        inputElement.value = '';
        await renderProjectsAndTasks(); // Refresh the UI
        showToast('success', 'Comment added successfully');
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('error', 'Failed to add comment');
    }
}

async function deleteComment(projectId, taskId, commentId) {
    const token = sessionStorage.getItem("sessionToken");

    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete comment');
        }
        
        await renderProjectsAndTasks(); // Refresh the UI
        showToast('success', 'Comment deleted successfully');
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('error', 'Failed to delete comment');
    }
}

async function renderProjectsAndTasks() {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';

    const projects = await fetchUserProjects();

    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12 text-center">
                <svg class="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                </svg>
                <p class="text-xl font-medium text-gray-600">No projects found</p>
                <p class="text-gray-500 mt-1">Create your first project to get started</p>
            </div>`;
        return;
    }

    for (const project of projects) {
        const tasks = await fetchProjectTasks(project.projectId) || [];

        const teamHTML = (await Promise.all(
            project.team.map(async member => {
                const name = toTitleCase(await fetchUserById(member.userId));
                return `
                    <div class="bg-white rounded-lg border border-gray-200 shadow-sm flex items-center p-3 hover:shadow-md transition-shadow">
                        <div class="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mr-3">
                            ${name.charAt(0)}
                        </div>
                        <div>
                            <div class="font-medium text-gray-800">${name}</div>
                            <div class="text-xs text-gray-500">${member.role}</div>
                        </div>
                    </div>
                `;
            })
        )).join('');

        const completedTasks = tasks.filter(task => task.status === 'Done').length;
        const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

        const tasksHTML = await Promise.all(tasks.map(async task => {
            // Fetch comments for each task
            const comments = await fetchTaskComments(project.projectId, task.taskId) || [];
            
            const commentsHTML = (await Promise.all(comments.map(async comment => {
            const name = toTitleCase(await fetchUserById(comment.userId));
            return `
                <div class="bg-white rounded-lg border border-gray-100 p-3 mb-2 hover:shadow-sm transition-shadow">
                        <div class="flex items-center justify-between">
                            <div class="font-medium text-sm text-gray-900">${name}</div>
                            <button onclick="deleteComment('${project.projectId}', '${task.taskId}', '${comment.commentId}'); event.stopPropagation();" 
                                class="text-gray-400 hover:text-red-500 transition-colors">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="text-sm mt-1">${comment.message}</div>
                        <div class="text-xs text-gray-400 mt-1">${formatDateUTC(comment.timestamp)}</div>
                    </div>
            `;
        }))).join('');

        // Get task color from the existing function
        const taskColor = getTaskColor(task.status);

        return `
            <div class="bg-white rounded-lg border-gray-200 shadow-sm hover:shadow-md transition-all p-4 group relative">
                <div class="flex justify-between items-start mb-2">
                    <span class="font-medium text-gray-900">${task.name}</span>
                    <span class="px-2 py-1 rounded text-white text-xs" 
                      style="background-color: ${taskColor}">${task.status}</span>
                </div>
                <div class="text-sm text-gray-600 mb-3">${task.deliverable}</div>
                <div class="flex items-center text-xs text-gray-500 mb-3">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
                    </svg>
                        ${formatDateUTC(task.startDate)} - ${formatDateUTC(task.endDate)}
                </div>
                
                <div class="opacity-0 group-hover:opacity-100 flex justify-end space-x-2 mb-3 transition-opacity">
                    <button onclick="markTaskAsDone('${project.projectId}', '${task.taskId}')" 
                        class="bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-md transition-colors flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        Complete
                    </button>
                    <button onclick="deleteTask('${project.projectId}', '${task.taskId}')" 
                        class="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium px-2 py-1 rounded-md transition-colors flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        Delete
                    </button>
                </div>

                <!-- Comments section -->
                <div class="pt-3 border-t border-gray-100">
                    <div class="flex items-center text-xs font-medium text-gray-700 mb-2">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clip-rule="evenodd"></path>
                        </svg>
                        Comments (${comments.length})
                    </div>
                    <div class="comments-container max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-1">
                        ${commentsHTML}
                    </div>
                    <div class="flex mt-2">
                        <input type="text" id="comment-input-${task.taskId}" 
                            class="flex-grow border border-gray-200 rounded-l-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
                            placeholder="Add a comment...">
                        <button onclick="addComment('${project.projectId}', '${task.taskId}')" 
                            class="bg-indigo-600 text-white px-3 py-1 rounded-r-md text-sm hover:bg-indigo-700 transition-colors">
                            Send
                        </button>
                    </div>
                </div>
            </div>
            `;
        }));

        const projectElement = document.createElement('details');
        projectElement.classList.add('mb-6', 'bg-white', 'rounded-lg', 'shadow', 'overflow-hidden', 'border', 'border-gray-200');
        projectElement.innerHTML = `
            <summary class="cursor-pointer p-5 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <h3 class="text-lg font-bold text-gray-900">${project.name}</h3>
                        <span class="text-sm font-medium ${progress === 100 ? 'text-green-600' : 'text-blue-600'}">
                            ${progress}% Complete
                        </span>
                    </div>
                    <p class="text-gray-600 text-sm">${project.description || 'No description'}</p>
                    
                    <!-- Progress bar -->
                    <div class="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                        <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                </div>
                <button onclick="deleteProject('${project.projectId}'); event.stopPropagation();" 
                    class="ml-4 text-gray-400 hover:text-red-500 transition-colors">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </summary>
            <div class="p-5 space-y-6 bg-gray-50 border-t border-gray-200">
                <!-- Tasks Section -->
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="font-medium text-gray-900 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-indigo-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
                            </svg>
                            Tasks (${tasks.length})
                        </h4>
                        <button onclick="showAddTaskModal('${project.projectId}')" 
                            class="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                            Add Task
                        </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${tasksHTML.length > 0 ? tasksHTML : 
                          `<div class="col-span-2 bg-white p-6 rounded-lg border border-gray-200 text-center">
                              <p class="text-gray-500">No tasks yet. Add your first task to get started.</p>
                           </div>`}
                    </div>
                </div>

                <!-- Team Members Section -->
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="font-medium text-gray-900 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-indigo-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                            </svg>
                            Team Members (${project.team.length})
                        </h4>
                        <button onclick="showAddMemberModal('${project.projectId}')" 
                            class="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                            </svg>
                            Add Member
                        </button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        ${teamHTML.length > 0 ? teamHTML : 
                          `<div class="col-span-3 bg-white p-6 rounded-lg border border-gray-200 text-center">
                              <p class="text-gray-500">No team members yet. Add your first team member to collaborate.</p>
                           </div>`}
                    </div>
                </div>
            </div>
        `;

        container.appendChild(projectElement);
    }
}

async function fetchUserById(userId) {
    try {
        const res = await fetch(`${API_BASE_URL}/user/${userId}`);
        if (!res.ok) throw new Error('User not found');
        const data = await res.json();
        return data.name || userId;
    } catch (err) {
        console.error('Failed to fetch user by ID:', err);
        return userId;
    }
}

async function fetchNotifications() {
    const token = sessionStorage.getItem("sessionToken");

    try {      
        // Add query parameter if filtering by read status
        // if (filterRead !== null) {
        //     url += `?read=${filterRead}`;
        // }
        
        const response = await fetch(`${API_BASE_URL}/notifications`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch notifications');
        }
        
        const data = await response.json();
        return data.notifications;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        showToast('error', 'Failed to load notifications');
        return [];
    }
}

async function markNotificationAsRead(notificationId) {
    const token = sessionStorage.getItem("sessionToken");

    try {
        const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to mark notification as read');
        }
        
        // Refresh notifications in UI
        await renderNotifications();
        return true;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        showToast('error', 'Failed to update notification');
        return false;
    }
}

async function markAllNotificationsAsRead() {
    const token = sessionStorage.getItem("sessionToken");
    
    try {
        const response = await fetch('/notifications/mark-all-read', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to mark all notifications as read');
        }
        
        const data = await response.json();
        showToast('success', `Marked ${data.count} notifications as read`);
        
        // Refresh notifications in UI
        await renderNotifications();
        return true;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        showToast('error', 'Failed to update notifications');
        return false;
    }
}

async function renderNotifications() {
    const notificationsContainer = document.getElementById('notifications-container');
    const notificationBadge = document.getElementById('notification-badge');
    
    if (!notificationsContainer) return;
    
    // Show loading state
    notificationsContainer.innerHTML = '<div class="text-center p-4">Loading notifications...</div>';
    
    try {
        // Get all notifications
        const notifications = await fetchNotifications();
        
        // Count unread notifications
        const unreadCount = notifications.filter(notif => !notif.read).length;
        
        // Update the notification badge
        if (notificationBadge) {
            if (unreadCount > 0) {
                notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                notificationBadge.classList.remove('hidden');
            } else {
                notificationBadge.classList.add('hidden');
            }
        }

        // Create the notifications header
        let notificationsHTML = `
            <div class="sticky top-0 flex justify-between items-center p-3 bg-white border-b z-10">
                <h3 class="font-bold">Notifications</h3>
                <button onclick="markAllNotificationsAsRead()" class="text-sm text-blue-500 hover:text-blue-700 focus:outline-none">
                    Mark all as read
                </button>
            </div>
        `;
        
        // If no notifications
        if (notifications.length === 0) {
            notificationsHTML += '<div class="flex flex-col items-center justify-center p-6 text-gray-500"><svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>No notifications</div>';
        } else {
            // Add each notification
            notificationsHTML += '<div class="max-h-80 overflow-y-auto">';
            notifications.forEach(notification => {
                notificationsHTML += `
                    <div class="notification-item p-3 border-b hover:bg-gray-50 ${notification.read ? 'bg-white' : 'bg-blue-50'} cursor-pointer" 
                         onclick="handleNotificationClick('${notification.notificationId}', '${notification.link || ''}')">
                        <div class="flex items-start gap-2">
                            ${!notification.read ? 
                                '<span class="h-2 w-2 mt-1.5 bg-blue-500 rounded-full flex-shrink-0"></span>' : 
                                '<span class="h-2 w-2 mt-1.5 rounded-full flex-shrink-0"></span>'}
                            <div class="flex-1">
                                <div class="font-medium">${notification.title}</div>
                                <div class="text-sm text-gray-600">${notification.body}</div>
                                <div class="text-xs text-gray-500 mt-1">${formatDateUTC(notification.timestamp)}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
            notificationsHTML += '</div>';
        }
        
        notificationsContainer.innerHTML = notificationsHTML;
    } catch (error) {
        console.error('Error rendering notifications:', error);
        notificationsContainer.innerHTML = '<div class="flex flex-col items-center justify-center p-6 text-red-500"><svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Failed to load notifications</div>';
    }
}

async function handleNotificationClick(notificationId, link) {
    await markNotificationAsRead(notificationId);
    
    // If the notification has a link, navigate to it
    if (link && link.trim() !== '') {
        window.location.href = link;
    }
}

// Dashboard rendering function
async function renderDashboard() {
    try {
        const projects = await fetchUserProjects();
        let allTasks = [];
        let completedTasks = 0;
        let totalTasks = 0;
        let upcomingDeadlines = [];
        let recentActivities = [];
        
        // Process project data
        for (const project of projects) {
            const tasks = await fetchProjectTasks(project.projectId) || [];
            
            // Add project info to each task
            const tasksWithProject = tasks.map(task => ({
                ...task,
                projectName: project.name,
                projectId: project.projectId
            }));
            
            allTasks = [...allTasks, ...tasksWithProject];
            
            // Count completed tasks
            completedTasks += tasks.filter(task => task.status === 'completed').length;
            totalTasks += tasks.length;
        }
        
        // Get upcoming deadlines (tasks ending in the next 7 days)
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        
        upcomingDeadlines = allTasks
            .filter(task => {
                const endDate = new Date(task.endDate);
                return endDate >= today && endDate <= nextWeek && task.status !== 'completed';
            })
            .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
        
        // Get recently updated tasks (assuming tasks have an updatedAt property)
        const recentTasks = [...allTasks]
            .sort((a, b) => new Date(b.updatedAt || b.endDate) - new Date(a.updatedAt || a.endDate))
            .slice(0, 5);
        
        // Get notifications
        const notifications = await fetchNotifications();
        const recentNotifications = notifications
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5);
        
        // Render dashboard sections
        renderDashboardSummary(projects.length, totalTasks, completedTasks);
        renderUpcomingDeadlines(upcomingDeadlines);
        renderProjectList(projects.slice(0, 5)); // Show top 5 projects
        renderTaskList(recentTasks);
        renderRecentActivity(recentNotifications);
        renderTasksByStatus(allTasks);
        
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        document.getElementById('dashboardSection').innerHTML = `
            <div class="container mx-auto">
                <div class="bg-red-100 p-4 rounded-lg border border-red-300 text-red-700">
                    <p>Error loading dashboard. Please try again later.</p>
                </div>
            </div>
        `;
    }
}

// Render dashboard summary cards
function renderDashboardSummary(projectCount, taskCount, completedTasks) {
    const container = document.getElementById('dashboardSummary');
    if (!container) return;
    
    const completionRate = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0;
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                <div class="font-bold text-gray-600 mb-1">Total Projects</div>
                <div class="text-3xl font-bold">${projectCount}</div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                <div class="font-bold text-gray-600 mb-1">Total Tasks</div>
                <div class="text-3xl font-bold">${taskCount}</div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
                <div class="font-bold text-gray-600 mb-1">Completed Tasks</div>
                <div class="text-3xl font-bold">${completedTasks}</div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                <div class="font-bold text-gray-600 mb-1">Completion Rate</div>
                <div class="text-3xl font-bold">${completionRate}%</div>
                <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                    <div class="bg-yellow-500 h-2.5 rounded-full" style="width: ${completionRate}%"></div>
                </div>
            </div>
        </div>
    `;
}

// Render upcoming deadlines
function renderUpcomingDeadlines(deadlines) {
    const container = document.getElementById('upcomingDeadlines');
    if (!container) return;
    
    if (deadlines.length === 0) {
        container.innerHTML = `
            <div class="p-4 text-center text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" 
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No upcoming deadlines in the next 7 days.</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full">
                <thead>
                    <tr class="bg-gray-50">
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;
    
    deadlines.forEach(task => {
        // Calculate days remaining
        const today = new Date();
        const deadline = new Date(task.endDate);
        const daysRemaining = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
        
        // Determine urgency color
        let urgencyColor = 'text-green-600';
        if (daysRemaining <= 1) {
            urgencyColor = 'text-red-600 font-bold';
        } else if (daysRemaining <= 3) {
            urgencyColor = 'text-yellow-600';
        }
        
        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 whitespace-nowrap">
                    <div class="font-medium text-gray-900">${task.name}</div>
                </td>
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    ${task.projectName}
                </td>
                <td class="px-4 py-2 whitespace-nowrap">
                    <div class="${urgencyColor}">
                        ${formatDateUTC(task.endDate)}
                        <span class="text-xs ml-1">(${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left)</span>
                    </div>
                </td>
                <td class="px-4 py-2 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(task.status)}">
                        ${task.status}
                    </span>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

// Render project list for dashboard
function renderProjectList(projects) {
    const container = document.getElementById('projectList');
    if (!container) return;
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No projects yet. Create your first project!</p>';
        return;
    }
    
    let html = '';
    
    projects.forEach(project => {
        html += `
            <li class="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-blue-500">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="font-medium">${project.name}</h3>
                        <p class="text-sm text-gray-500 truncate">${project.description || 'No description'}</p>
                    </div>
                    <a href="#" onclick="navigateToProject('${project.projectId}')" class="text-blue-500 hover:text-blue-700 text-sm">
                        View &rarr;
                    </a>
                </div>
            </li>
        `;
    });
    
    container.innerHTML = html;
}

// Render task list for dashboard
function renderTaskList(tasks) {
    const container = document.getElementById('taskList');
    if (!container) return;
    
    if (tasks.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No tasks yet.</p>';
        return;
    }
    
    let html = '';
    
    tasks.forEach(task => {
        html += `
            <li class="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border-l-4 ${
                task.status === 'completed' ? 'border-green-500' : 
                new Date(task.endDate) < new Date() ? 'border-red-500' : 'border-yellow-500'
            }">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}">${task.name}</h3>
                        <p class="text-xs text-gray-500 mt-1">Project: ${task.projectName}</p>
                        <p class="text-xs text-gray-500">Due: ${formatDateUTC(task.endDate)}</p>
                    </div>
                    <span class="px-2 py-1 text-xs rounded-full ${getStatusClass(task.status)}">
                        ${task.status}
                    </span>
                </div>
            </li>
        `;
    });
    
    container.innerHTML = html;
}

// Render recent activity
function renderRecentActivity(notifications) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No recent activity.</p>';
        return;
    }
    
    let html = '<ul class="space-y-3">';
    
    notifications.forEach(notification => {
        html += `
            <li class="bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow border-l-4 border-gray-300">
                <div class="font-medium">${notification.title}</div>
                <div class="text-sm text-gray-600">${notification.body}</div>
                <div class="text-xs text-gray-500 mt-1">${formatDateUTC(notification.timestamp)}</div>
            </li>
        `;
    });
    
    html += '</ul>';
    container.innerHTML = html;
}

// Render tasks by status chart
function renderTasksByStatus(tasks) {
    const container = document.getElementById('tasksByStatus');
    if (!container) return;
    
    // Count tasks by status
    const statusCounts = {};
    tasks.forEach(task => {
        const status = task.status || 'pending';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    // Define colors for each status
    const statusColors = {
        'completed': '#10B981', // green
        'in_progress': '#3B82F6', // blue
        'pending': '#F59E0B', // amber
        'overdue': '#EF4444', // red
        'cancelled': '#6B7280', // gray
    };
    
    // Create chart data
    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    const colors = labels.map(label => statusColors[label] || '#6B7280');
    
    // Create a simple bar chart visualization with HTML/CSS
    let html = '<div class="space-y-3">';
    
    labels.forEach((label, index) => {
        const percentage = tasks.length > 0 ? (data[index] / tasks.length) * 100 : 0;
        
        html += `
            <div>
                <div class="flex justify-between mb-1">
                    <span class="text-sm font-medium">${toTitleCase(label)}</span>
                    <span class="text-sm font-medium">${data[index]} (${Math.round(percentage)}%)</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div class="h-2.5 rounded-full" style="width: ${percentage}%; background-color: ${colors[index]}"></div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Helper function to navigate to a specific project
function navigateToProject(projectId) {
    // Show the projects section
    showSection('projectsSection');
    
    // Find and open the project details
    setTimeout(() => {
        const projectElement = document.querySelector(`details[data-project-id="${projectId}"]`);
        if (projectElement) {
            projectElement.open = true;
            projectElement.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

// Call this function when the page loads to set up event listeners
function initializeDashboard() {
    // Update dashboard when it becomes visible
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
                const dashboardSection = document.getElementById('dashboardSection');
                if (dashboardSection && !dashboardSection.classList.contains('hidden')) {
                    renderDashboard();
                }
            }
        });
    });
    
    const dashboardSection = document.getElementById('dashboardSection');
    if (dashboardSection) {
        observer.observe(dashboardSection, { attributes: true });
        
        // Initial render if dashboard is visible
        if (!dashboardSection.classList.contains('hidden')) {
            renderDashboard();
        }
    }
    
    // Make dashboard update when returning to it
    document.getElementById('navDashboard')?.addEventListener('click', () => {
        setTimeout(renderDashboard, 100);
    });
}

// Project creation and rendering functions
document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
            
    const projectData = {
        projectId: 'proj_' + Date.now(), // Generate a unique project ID
        name: document.getElementById('projectName').value,
        description: document.getElementById('projectDesc').value,
        ownerId: sessionStorage.getItem('userId') // Get the current user's ID
    };

    try {
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem("sessionToken")}`
            },
            body: JSON.stringify(projectData)
        });

        // Check if session expired
        if (response.status === 401) {
            handleSessionExpired();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to create project');
        }
        
        closeCreateProjectModal();
        renderProjectsAndTasks();
    } catch (error) {
        console.error('Error creating project:', error);
        alert('Failed to create project. Please try again.');
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const token = sessionStorage.getItem("sessionToken");
    const userId = sessionStorage.getItem('userId');
    
    if (token && userId) {
        // User is logged in, show main section
        showMainSection();
        initWebSocket();
    } else {
        // User is not logged in, show auth section
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('mainSection').classList.add('hidden');
    }

    renderNotifications();

    renderProjectsAndTasks();
    
    document.getElementById('navDashboard').addEventListener('click', function (event) {
        event.preventDefault();
        showSection('dashboardSection');
        initializeDashboard();
    });

    document.getElementById('navProjects').addEventListener('click', async function (event) {
        event.preventDefault();
        showSection('projectsSection');
        renderProjectsAndTasks();
    });

    document.getElementById('navCalendar').addEventListener('click', function (event) {
        event.preventDefault();
        showSection('calendarSection');
        renderCalendar();
    });

     // Set up periodic refresh (every 60 seconds)
    setInterval(renderNotifications, 60000);
    
    // Set up notification toggle button if it exists
    const notificationToggle = document.getElementById('notification-toggle');
    const notificationsDropdown = document.getElementById('notifications-dropdown');
    
    if (notificationToggle && notificationsDropdown) {
        notificationToggle.addEventListener('click', () => {
            const isHidden = notificationsDropdown.classList.contains('hidden');
            
            if (isHidden) {
                // Show dropdown and refresh notifications
                notificationsDropdown.classList.remove('hidden');
                renderNotifications();
            } else {
                // Hide dropdown
                notificationsDropdown.classList.add('hidden');
            }
        });
        
        // Close notifications when clicking outside
        document.addEventListener('click', (event) => {
            if (!notificationToggle.contains(event.target) && 
                !notificationsDropdown.contains(event.target)) {
                notificationsDropdown.classList.add('hidden');
            }
        });
    }

    // Add a connection status indicator to the header
    const headerElement = document.querySelector('header') || document.body;
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'wsStatus';
    statusIndicator.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-1 rounded-full text-xs flex items-center opacity-75 hover:opacity-100 transition-opacity';
    statusIndicator.innerHTML = '<span class="h-2 w-2 bg-gray-500 rounded-full mr-2"></span> Connecting...';
    headerElement.appendChild(statusIndicator);
    
    // Update status indicator based on WebSocket state
    function updateConnectionStatus() {
        const indicator = document.getElementById('wsStatus');
        if (!indicator) return;
        
        if (!websocket || websocket.readyState === WebSocket.CLOSED) {
            indicator.innerHTML = '<span class="h-2 w-2 bg-red-500 rounded-full mr-2"></span> Disconnected';
        } else if (websocket.readyState === WebSocket.CONNECTING) {
            indicator.innerHTML = '<span class="h-2 w-2 bg-yellow-500 rounded-full mr-2"></span> Connecting...';
        } else if (websocket.readyState === WebSocket.OPEN) {
            indicator.innerHTML = '<span class="h-2 w-2 bg-green-500 rounded-full mr-2"></span> Connected';
            // Hide indicator after 3 seconds if connected
            setTimeout(() => {
                indicator.classList.add('opacity-0');
            }, 3000);
        }
    }
    
    // Set interval to check WebSocket status
    setInterval(updateConnectionStatus, 1000);
});