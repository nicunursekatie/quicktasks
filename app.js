// Firebase will be initialized in index.html
// Initial task data
const initialData = {
    today: [
        {
            groupName: "Giving Tuesday",
            tasks: [
                { title: "Pull list of everyone who got the first GT email", completed: false },
                { title: "Identify who has already donated", completed: false },
                { title: "Remove donors from the next send", completed: false },
                { title: "Finalize content for the second GT email", completed: false }
            ]
        },
        {
            groupName: "Steve's PowerPoint",
            tasks: [
                { title: "Open Alloy", completed: false },
                { title: "Work on Steve's PowerPoint deck in Alloy", completed: false }
            ]
        }
    ],
    longterm: [
        {
            groupName: "Strategic Comms Shift",
            tasks: [
                { title: "Move non-urgent comms and random ideas from group texts → app", completed: false },
                { title: "Build UI for idea submission so nothing gets lost", completed: false }
            ]
        },
        {
            groupName: "Volunteer Speakers",
            tasks: [
                { title: "Onboard volunteer speakers into the app", completed: false },
                { title: "Clean event-signup UI so they can see and self-select upcoming events", completed: false }
            ]
        },
        {
            groupName: "Drivers",
            tasks: [
                {
                    title: "Long-term: drivers should browse events, self-sign up, and get notifications",
                    completed: false,
                    subtasks: [
                        { title: "Requires accurate driver location data in the database", completed: false }
                    ]
                }
            ]
        },
        {
            groupName: "Jordan Clarification",
            tasks: [
                {
                    title: "Have the 5-minute convo about driver list updates",
                    completed: false,
                    subtasks: [
                        { title: "Clarify: update driver list not for agreements, but to fill in driver locations to power app tools", completed: false }
                    ]
                }
            ]
        },
        {
            groupName: "Alloy Folder",
            tasks: [
                { title: "Review the Alloy folder for materials relevant to Steve's deck", completed: false }
            ]
        },
        {
            groupName: "Mobile + Urgent Comms Problem",
            tasks: [
                {
                    title: "Long-term plan to onboard users with SMS consent for urgent items",
                    completed: false,
                    subtasks: [
                        { title: "Build targeted text system for urgent comms", completed: false },
                        { title: "Possibly build separate mobile-optimized version or separate mobile app", completed: false }
                    ]
                }
            ]
        }
    ]
};

// Load data from localStorage or use initial data
let taskData = JSON.parse(localStorage.getItem('taskData')) || initialData;
let settings = JSON.parse(localStorage.getItem('settings')) || {
    darkMode: false,
    showCompleted: true
};

let currentUser = null;
let unsubscribe = null;

// Initialize
function init() {
    updateDateStamp();
    applyTheme();
    renderTasks();
    updateStats();
    updateProgress();
}

// Update date stamp
function updateDateStamp() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date().toLocaleDateString('en-US', options);
    document.getElementById('dateStamp').textContent = date;
}

// Render all tasks
function renderTasks() {
    renderSection('today', 'todayTasks');
    renderSection('longterm', 'longtermTasks');
}

// Render a section
function renderSection(section, containerId) {
    const container = document.getElementById(containerId);
    const groups = taskData[section];

    if (!groups || groups.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <div>No tasks yet. Add one to get started!</div>
            </div>
        `;
        return;
    }

    container.innerHTML = groups.map((group, groupIndex) => {
        const totalTasks = group.tasks.length;
        const completedTasks = group.tasks.filter(t => t.completed).length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        return `
            <div class="task-group">
                <h2>
                    ${group.groupName}
                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 400;">
                        (${completedTasks}/${totalTasks})
                    </span>
                </h2>
                <div class="group-progress">
                    <div class="group-progress-fill" style="width: ${progress}%"></div>
                </div>
                ${group.tasks.map((task, taskIndex) => renderTask(section, groupIndex, taskIndex, task)).join('')}
            </div>
        `;
    }).join('');
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render a single task
function renderTask(section, groupIndex, taskIndex, task) {
    if (!settings.showCompleted && task.completed) return '';

    return `
        <div class="task-item ${task.completed ? 'checked' : ''}" onclick="event.stopPropagation()">
            <div class="task-content" onclick="editTask('${section}', ${groupIndex}, ${taskIndex})" style="cursor: pointer;">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${task.subtasks ? `
                    <div class="subtasks">
                        ${task.subtasks.map((subtask, subIndex) => `
                            <div class="subtask ${subtask.completed ? 'checked' : ''}" onclick="event.stopPropagation(); editSubtask('${section}', ${groupIndex}, ${taskIndex}, ${subIndex})" style="cursor: pointer;">
                                <span>${escapeHtml(subtask.title)}</span>
                                <button class="subtask-delete-btn" onclick="event.stopPropagation(); deleteSubtask('${section}', ${groupIndex}, ${taskIndex}, ${subIndex})" title="Delete subtask">×</button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="task-actions">
                <button class="edit-btn" onclick="editTask('${section}', ${groupIndex}, ${taskIndex})" title="Edit task">✏️</button>
                <button class="delete-btn" onclick="deleteTask('${section}', ${groupIndex}, ${taskIndex})" title="Delete task">🗑️</button>
            </div>
        </div>
    `;
}

// Edit task
window.editTask = function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    const newTitle = prompt('Edit task:', task.title);

    if (newTitle !== null && newTitle.trim() !== '') {
        task.title = newTitle.trim();
        saveData();
        renderTasks();
    }
}

// Edit subtask
window.editSubtask = function(section, groupIndex, taskIndex, subIndex) {
    const subtask = taskData[section][groupIndex].tasks[taskIndex].subtasks[subIndex];
    const newTitle = prompt('Edit subtask:', subtask.title);

    if (newTitle !== null && newTitle.trim() !== '') {
        subtask.title = newTitle.trim();
        saveData();
        renderTasks();
    }
}

// Delete task with confirmation
window.deleteTask = function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];

    if (confirm(`Are you sure you want to delete this task?\n\n"${task.title}"\n\nThis action cannot be undone.`)) {
        taskData[section][groupIndex].tasks.splice(taskIndex, 1);
        if (taskData[section][groupIndex].tasks.length === 0) {
            taskData[section].splice(groupIndex, 1);
        }
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }
}

// Delete subtask with confirmation
window.deleteSubtask = function(section, groupIndex, taskIndex, subIndex) {
    const subtask = taskData[section][groupIndex].tasks[taskIndex].subtasks[subIndex];

    if (confirm(`Are you sure you want to delete this subtask?\n\n"${subtask.title}"\n\nThis action cannot be undone.`)) {
        taskData[section][groupIndex].tasks[taskIndex].subtasks.splice(subIndex, 1);

        // Remove subtasks array if empty
        if (taskData[section][groupIndex].tasks[taskIndex].subtasks.length === 0) {
            delete taskData[section][groupIndex].tasks[taskIndex].subtasks;
        }

        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }
}

// Quick add task
window.handleQuickAdd = function(event, section) {
    if (event.key === 'Enter') {
        addQuickTask(section);
    }
}

window.addQuickTask = function(section) {
    const inputId = section === 'today' ? 'quickAddToday' : 'quickAddLongterm';
    const input = document.getElementById(inputId);
    const title = input.value.trim();

    if (!title) return;

    // Add to "Quick Tasks" group or create it
    let quickGroup = taskData[section].find(g => g.groupName === 'Quick Tasks');
    if (!quickGroup) {
        quickGroup = { groupName: 'Quick Tasks', tasks: [] };
        taskData[section].unshift(quickGroup);
    }

    quickGroup.tasks.push({ title, completed: false });
    input.value = '';

    saveData();
    renderTasks();
    updateStats();
    updateProgress();
}

// Update statistics
function updateStats() {
    let totalTasks = 0;
    let completedTasks = 0;
    let completedToday = 0;

    ['today', 'longterm'].forEach(section => {
        taskData[section].forEach(group => {
            group.tasks.forEach(task => {
                totalTasks++;
                if (task.completed) {
                    completedTasks++;
                    if (section === 'today') completedToday++;
                }
            });
        });
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    document.getElementById('statCompletedToday').textContent = completedToday;
    document.getElementById('statTotalTasks').textContent = totalTasks;
    document.getElementById('statCompletionRate').textContent = completionRate + '%';
    document.getElementById('statActiveProjects').textContent = taskData.longterm.length;
}

// Update progress rings
function updateProgress() {
    updateSectionProgress('today', 'todayProgress');
    updateSectionProgress('longterm', 'longtermProgress');
}

function updateSectionProgress(section, progressId) {
    let total = 0;
    let completed = 0;

    taskData[section].forEach(group => {
        group.tasks.forEach(task => {
            total++;
            if (task.completed) completed++;
        });
    });

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const circumference = 100.48;
    const offset = circumference - (percentage / 100) * circumference;

    const progressRing = document.getElementById(progressId);
    const circle = progressRing.querySelector('.progress-circle-fill');
    const text = progressRing.querySelector('.progress-text');

    circle.style.strokeDashoffset = offset;
    text.textContent = percentage + '%';
}

// Toggle theme
window.toggleTheme = function() {
    settings.darkMode = !settings.darkMode;
    applyTheme();
    saveData();
}

function applyTheme() {
    if (settings.darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('darkModeToggle').classList.add('active');
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.getElementById('darkModeToggle').classList.remove('active');
    }
}

// Toggle show completed
window.toggleShowCompleted = function() {
    settings.showCompleted = !settings.showCompleted;
    const toggle = document.getElementById('showCompletedToggle');
    if (settings.showCompleted) {
        toggle.classList.add('active');
    } else {
        toggle.classList.remove('active');
    }
    saveData();
    renderTasks();
}

// Toggle stats panel
window.toggleStats = function() {
    const panel = document.getElementById('statsPanel');
    const overlay = document.getElementById('overlay');
    panel.classList.toggle('open');
    overlay.classList.toggle('active');
    updateStats();
}

// Toggle settings panel
window.toggleSettings = function() {
    const panel = document.getElementById('settingsPanel');
    const overlay = document.getElementById('overlay');
    panel.classList.toggle('open');
    overlay.classList.toggle('active');
}

// Close panels when clicking overlay
document.getElementById('overlay').addEventListener('click', function() {
    document.getElementById('statsPanel').classList.remove('open');
    document.getElementById('settingsPanel').classList.remove('open');
    this.classList.remove('active');
});

// Clear all data with double confirmation
window.clearAllData = function() {
    const firstConfirm = confirm('⚠️ WARNING: This will permanently delete ALL your tasks and settings.\n\nAre you sure you want to continue?');

    if (firstConfirm) {
        const secondConfirm = confirm('⚠️ FINAL WARNING: This action CANNOT be undone!\n\nType YES in your mind and click OK to proceed with deleting everything.');

        if (secondConfirm) {
            localStorage.clear();
            taskData = initialData;
            settings = { darkMode: false, showCompleted: true };
            init();
            alert('✓ All data has been cleared and reset to defaults.');
        }
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('taskData', JSON.stringify(taskData));
    localStorage.setItem('settings', JSON.stringify(settings));
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Cmd/Ctrl + K to focus quick add
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('quickAddToday').focus();
    }
    // Escape to close panels
    if (e.key === 'Escape') {
        document.getElementById('statsPanel').classList.remove('open');
        document.getElementById('settingsPanel').classList.remove('open');
        document.getElementById('overlay').classList.remove('active');
    }
});

// Initialize on load
init();
