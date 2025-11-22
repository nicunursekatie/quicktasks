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
    showCompleted: true,
    openaiApiKey: '',
    geminiApiKey: '',
    groqApiKey: '',
    anthropicApiKey: '',
    aiProvider: 'gemini'
};

let currentUser = null;
let unsubscribe = null;

// Custom Modal System
let modalResolve = null;

function showCustomModal(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        modalResolve = resolve;
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;
        const input = document.getElementById('modalInput');
        input.value = defaultValue;
        document.getElementById('customModal').classList.add('active');
        input.focus();

        // Handle keyboard shortcuts
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeCustomModal();
                input.removeEventListener('keydown', handleKeyDown);
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                submitCustomModal();
                input.removeEventListener('keydown', handleKeyDown);
            }
        };
        input.addEventListener('keydown', handleKeyDown);
    });
}

function closeCustomModal() {
    document.getElementById('customModal').classList.remove('active');
    if (modalResolve) {
        modalResolve(null);
        modalResolve = null;
    }
}

function submitCustomModal() {
    const value = document.getElementById('modalInput').value;
    document.getElementById('customModal').classList.remove('active');
    if (modalResolve) {
        modalResolve(value);
        modalResolve = null;
    }
}

// Make functions globally available
window.showCustomModal = showCustomModal;
window.closeCustomModal = closeCustomModal;
window.submitCustomModal = submitCustomModal;

// Helper function to extract JSON from AI response
function extractJSON(response) {
    // Try direct parse first
    try {
        return JSON.parse(response);
    } catch (e) {
        // Look for JSON in markdown code blocks
        const codeBlockMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
            try {
                return JSON.parse(codeBlockMatch[1]);
            } catch (e2) {
                // Continue to next attempt
            }
        }

        // Look for JSON array or object anywhere in the response
        const jsonMatch = response.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch (e3) {
                // Continue to next attempt
            }
        }

        throw new Error('Could not extract valid JSON from response');
    }
}

// Initialize
function init() {
    updateDateStamp();
    applyTheme();
    renderTasks();
    updateStats();
    updateProgress();
    loadOpenAIKey();
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
                <div class="group-header">
                    <h2 onclick="editGroupName('${section}', ${groupIndex})" style="cursor: pointer;" title="Click to edit project name">
                        ${escapeHtml(group.groupName)}
                        <span style="font-size: 12px; color: var(--text-muted); font-weight: 400;">
                            (${completedTasks}/${totalTasks})
                        </span>
                    </h2>
                    <div class="group-actions">
                        <button class="group-edit-btn" onclick="editGroupName('${section}', ${groupIndex})" title="Edit project name">✏️</button>
                        <button class="group-add-task-btn" onclick="addTaskToGroup('${section}', ${groupIndex})" title="Add task to project">➕</button>
                        <button class="group-move-btn" onclick="moveGroup('${section}', ${groupIndex})" title="Move to ${section === 'today' ? 'Ongoing' : 'Today'}">${section === 'today' ? '📅' : '⚡'}</button>
                        <button class="group-ai-btn" onclick="aiBreakdownProject('${section}', ${groupIndex})" title="AI: Break down project" style="background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); color: var(--text-primary); cursor: pointer; padding: 6px 10px; border-radius: 8px; font-size: 14px; transition: all 0.3s ease;">✨</button>
                        <button class="group-delete-btn" onclick="deleteGroup('${section}', ${groupIndex})" title="Delete project">🗑️</button>
                    </div>
                </div>
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
            <input type="checkbox"
                   class="task-checkbox"
                   ${task.completed ? 'checked' : ''}
                   onclick="toggleTask('${section}', ${groupIndex}, ${taskIndex})"
                   title="Mark as ${task.completed ? 'incomplete' : 'complete'}">
            <div class="task-content" onclick="editTask('${section}', ${groupIndex}, ${taskIndex})" style="cursor: pointer;">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${task.subtasks ? `
                    <div class="subtasks">
                        ${task.subtasks.map((subtask, subIndex) => `
                            <div class="subtask ${subtask.completed ? 'checked' : ''}" onclick="event.stopPropagation()">
                                <input type="checkbox"
                                       class="subtask-checkbox"
                                       ${subtask.completed ? 'checked' : ''}
                                       onclick="toggleSubtask('${section}', ${groupIndex}, ${taskIndex}, ${subIndex})"
                                       title="Mark subtask as ${subtask.completed ? 'incomplete' : 'complete'}">
                                <span onclick="editSubtask('${section}', ${groupIndex}, ${taskIndex}, ${subIndex})" style="cursor: pointer; flex: 1;">${escapeHtml(subtask.title)}</span>
                                <button class="subtask-delete-btn" onclick="event.stopPropagation(); deleteSubtask('${section}', ${groupIndex}, ${taskIndex}, ${subIndex})" title="Delete subtask">×</button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="task-actions">
                <button class="ai-btn" onclick="showAIMenu('${section}', ${groupIndex}, ${taskIndex})" title="AI Assistant">✨</button>
                <button class="edit-btn" onclick="editTask('${section}', ${groupIndex}, ${taskIndex})" title="Edit task">✏️</button>
                <button class="move-btn" onclick="moveTask('${section}', ${groupIndex}, ${taskIndex})" title="Move to ${section === 'today' ? 'Ongoing' : 'Today'}">${section === 'today' ? '📅' : '⚡'}</button>
                <button class="delete-btn" onclick="deleteTask('${section}', ${groupIndex}, ${taskIndex})" title="Delete task">🗑️</button>
            </div>
        </div>
    `;
}

// Toggle task completion
window.toggleTask = function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    task.completed = !task.completed;
    saveData();
    renderTasks();
    updateStats();
    updateProgress();
}

// Toggle subtask completion
window.toggleSubtask = function(section, groupIndex, taskIndex, subIndex) {
    const subtask = taskData[section][groupIndex].tasks[taskIndex].subtasks[subIndex];
    subtask.completed = !subtask.completed;
    saveData();
    renderTasks();
    updateStats();
    updateProgress();
}

// Edit group/project name
window.editGroupName = function(section, groupIndex) {
    const group = taskData[section][groupIndex];
    const newName = prompt('Edit project name:', group.groupName);

    if (newName !== null && newName.trim() !== '') {
        group.groupName = newName.trim();
        saveData();
        renderTasks();
    }
}

// Delete group/project with confirmation
window.deleteGroup = function(section, groupIndex) {
    const group = taskData[section][groupIndex];
    const taskCount = group.tasks.length;

    const confirmMsg = taskCount > 0
        ? `Are you sure you want to delete the project "${group.groupName}"?\n\nThis will delete ${taskCount} task${taskCount === 1 ? '' : 's'}.\n\nThis action cannot be undone.`
        : `Are you sure you want to delete the project "${group.groupName}"?\n\nThis action cannot be undone.`;

    if (confirm(confirmMsg)) {
        taskData[section].splice(groupIndex, 1);
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }
}

// Add task to specific group
window.addTaskToGroup = function(section, groupIndex) {
    const taskTitle = prompt('Enter new task:');

    if (taskTitle !== null && taskTitle.trim() !== '') {
        taskData[section][groupIndex].tasks.push({
            title: taskTitle.trim(),
            completed: false
        });
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }
}

// Task Edit Modal State
let currentEditTask = null;

// Edit task with modal
window.editTask = function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    currentEditTask = { section, groupIndex, taskIndex };

    // Populate modal
    document.getElementById('taskEditTitle').value = task.title;

    // Render subtasks
    const container = document.getElementById('taskEditSubtasksContainer');
    if (task.subtasks && task.subtasks.length > 0) {
        container.innerHTML = `
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">Subtasks</label>
                <div id="subtasksList"></div>
            </div>
        `;
        renderEditSubtasks();
    } else {
        container.innerHTML = '';
    }

    // Show modal
    document.getElementById('taskEditModal').classList.add('active');
    document.getElementById('taskEditTitle').focus();
}

function renderEditSubtasks() {
    const { section, groupIndex, taskIndex } = currentEditTask;
    const task = taskData[section][groupIndex].tasks[taskIndex];
    const list = document.getElementById('subtasksList');

    if (!task.subtasks || task.subtasks.length === 0) {
        list.innerHTML = '<p style="color: #999; font-size: 13px; font-style: italic;">No subtasks yet</p>';
        return;
    }

    list.innerHTML = task.subtasks.map((subtask, index) => `
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="text" value="${subtask.title.replace(/"/g, '&quot;')}"
                   data-subtask-index="${index}"
                   class="subtask-edit-input"
                   style="flex: 1; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 13px;">
            <button onclick="deleteSubtaskInEdit(${index})"
                    style="padding: 10px 14px; background: rgba(255, 0, 0, 0.1); color: #e74c3c; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                ×
            </button>
        </div>
    `).join('');
}

window.addSubtaskInEdit = function() {
    const { section, groupIndex, taskIndex } = currentEditTask;
    const task = taskData[section][groupIndex].tasks[taskIndex];

    if (!task.subtasks) {
        task.subtasks = [];
        document.getElementById('taskEditSubtasksContainer').innerHTML = `
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #333;">Subtasks</label>
                <div id="subtasksList"></div>
            </div>
        `;
    }

    task.subtasks.push({ title: '', completed: false });
    renderEditSubtasks();

    // Focus the new input
    setTimeout(() => {
        const inputs = document.querySelectorAll('.subtask-edit-input');
        if (inputs.length > 0) {
            inputs[inputs.length - 1].focus();
        }
    }, 0);
}

window.deleteSubtaskInEdit = function(index) {
    const { section, groupIndex, taskIndex } = currentEditTask;
    const task = taskData[section][groupIndex].tasks[taskIndex];

    task.subtasks.splice(index, 1);
    if (task.subtasks.length === 0) {
        delete task.subtasks;
        document.getElementById('taskEditSubtasksContainer').innerHTML = '';
    } else {
        renderEditSubtasks();
    }
}

window.closeTaskEditModal = function() {
    document.getElementById('taskEditModal').classList.remove('active');
    currentEditTask = null;
}

window.submitTaskEdit = function() {
    const { section, groupIndex, taskIndex } = currentEditTask;
    const task = taskData[section][groupIndex].tasks[taskIndex];

    // Update title
    const newTitle = document.getElementById('taskEditTitle').value.trim();
    if (newTitle) {
        task.title = newTitle;
    }

    // Update subtasks
    if (task.subtasks) {
        const inputs = document.querySelectorAll('.subtask-edit-input');
        inputs.forEach((input, index) => {
            const value = input.value.trim();
            if (value) {
                task.subtasks[index].title = value;
            }
        });

        // Remove empty subtasks
        task.subtasks = task.subtasks.filter(s => s.title.trim() !== '');
        if (task.subtasks.length === 0) {
            delete task.subtasks;
        }
    }

    saveData();
    renderTasks();
    closeTaskEditModal();
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

// Create new group/project
window.createNewGroup = function(section) {
    const groupName = prompt('Enter new project name:');

    if (groupName !== null && groupName.trim() !== '') {
        taskData[section].push({
            groupName: groupName.trim(),
            tasks: []
        });
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }
}

// Move group/project to other section
window.moveGroup = function(fromSection, groupIndex) {
    const toSection = fromSection === 'today' ? 'longterm' : 'today';
    const group = taskData[fromSection][groupIndex];
    const sectionName = toSection === 'today' ? 'Today' : 'Ongoing Projects';

    if (confirm(`Move "${group.groupName}" to ${sectionName}?`)) {
        // Remove from current section
        taskData[fromSection].splice(groupIndex, 1);

        // Add to target section
        taskData[toSection].push(group);

        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }
}

// Move task to other section
window.moveTask = function(fromSection, groupIndex, taskIndex) {
    const toSection = fromSection === 'today' ? 'longterm' : 'today';
    const task = taskData[fromSection][groupIndex].tasks[taskIndex];
    const sectionName = toSection === 'today' ? 'Today' : 'Ongoing Projects';

    // Remove task from current group
    taskData[fromSection][groupIndex].tasks.splice(taskIndex, 1);

    // Remove group if empty
    if (taskData[fromSection][groupIndex].tasks.length === 0) {
        taskData[fromSection].splice(groupIndex, 1);
    }

    // Add to "Quick Tasks" group in target section or create it
    let quickGroup = taskData[toSection].find(g => g.groupName === 'Quick Tasks');
    if (!quickGroup) {
        quickGroup = { groupName: 'Quick Tasks', tasks: [] };
        taskData[toSection].unshift(quickGroup);
    }

    quickGroup.tasks.push(task);

    saveData();
    renderTasks();
    updateStats();
    updateProgress();
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

// AI Provider Management
window.saveAIProvider = function() {
    const providerSelect = document.getElementById('aiProvider');
    settings.aiProvider = providerSelect.value;
    saveData();
}

window.saveAPIKeys = function() {
    const openaiInput = document.getElementById('openaiApiKey');
    const geminiInput = document.getElementById('geminiApiKey');
    const groqInput = document.getElementById('groqApiKey');
    const anthropicInput = document.getElementById('anthropicApiKey');

    if (openaiInput) settings.openaiApiKey = openaiInput.value.trim();
    if (geminiInput) settings.geminiApiKey = geminiInput.value.trim();
    if (groqInput) settings.groqApiKey = groqInput.value.trim();
    if (anthropicInput) settings.anthropicApiKey = anthropicInput.value.trim();

    saveData();
    alert('✓ API key saved!');
}

function loadOpenAIKey() {
    const openaiInput = document.getElementById('openaiApiKey');
    const geminiInput = document.getElementById('geminiApiKey');
    const groqInput = document.getElementById('groqApiKey');
    const anthropicInput = document.getElementById('anthropicApiKey');
    const providerSelect = document.getElementById('aiProvider');

    if (openaiInput && settings.openaiApiKey) {
        openaiInput.value = settings.openaiApiKey;
    }
    if (geminiInput && settings.geminiApiKey) {
        geminiInput.value = settings.geminiApiKey;
    }
    if (groqInput && settings.groqApiKey) {
        groqInput.value = settings.groqApiKey;
    }
    if (anthropicInput && settings.anthropicApiKey) {
        anthropicInput.value = settings.anthropicApiKey;
    }
    if (providerSelect) {
        providerSelect.value = settings.aiProvider || 'gemini';
    }
}

// Test API Keys
window.testOpenAIKey = async function() {
    const apiKey = document.getElementById('openaiApiKey').value.trim();
    if (!apiKey) {
        alert('⚠️ Please enter an OpenAI API key first!');
        return;
    }

    alert('🧪 Testing OpenAI API key...\n\nNote: This will likely fail due to CORS restrictions in the browser.');

    try {
        const response = await fetch('https://cors-anywhere.herokuapp.com/https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Say "API key works!"' }],
                max_tokens: 10
            })
        });

        if (response.ok) {
            alert('✅ OpenAI API Key is valid!');
        } else {
            const error = await response.json();
            alert(`❌ OpenAI API Key Error: ${error.error?.message || 'Invalid key'}`);
        }
    } catch (error) {
        alert(`❌ Test Failed: ${error.message}\n\nThis is expected - OpenAI blocks browser requests. The key might still work, but you need a backend server.`);
    }
}

window.testGeminiKey = async function() {
    const apiKey = document.getElementById('geminiApiKey').value.trim();
    if (!apiKey) {
        alert('⚠️ Please enter a Gemini API key first!');
        return;
    }

    alert('🧪 Testing Gemini API key...');

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: 'Say "API key works!"'
                    }]
                }]
            })
        });

        if (response.ok) {
            alert('✅ Gemini API Key is valid and working!');
        } else {
            const error = await response.json();
            alert(`❌ Gemini API Key Error: ${error.error?.message || 'Invalid key'}`);
        }
    } catch (error) {
        alert(`❌ Test Failed: ${error.message}`);
    }
}

window.testGroqKey = async function() {
    const apiKey = document.getElementById('groqApiKey').value.trim();
    if (!apiKey) {
        alert('⚠️ Please enter a Groq API key first!');
        return;
    }

    alert('🧪 Testing Groq API key...');

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'Say "API key works!"' }],
                max_tokens: 10
            })
        });

        if (response.ok) {
            alert('✅ Groq API Key is valid and working!');
        } else {
            const error = await response.json();
            alert(`❌ Groq API Key Error: ${error.error?.message || 'Invalid key'}`);
        }
    } catch (error) {
        alert(`❌ Test Failed: ${error.message}`);
    }
}

window.testAnthropicKey = async function() {
    const apiKey = document.getElementById('anthropicApiKey').value.trim();
    if (!apiKey) {
        alert('⚠️ Please enter an Anthropic API key first!');
        return;
    }

    alert('🧪 Testing Anthropic API key...');

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Say "API key works!"' }]
            })
        });

        if (response.ok) {
            alert('✅ Anthropic API Key is valid and working!');
        } else {
            const error = await response.json();
            alert(`❌ Anthropic API Key Error: ${error.error?.message || 'Invalid key'}`);
        }
    } catch (error) {
        alert(`❌ Test Failed: ${error.message}`);
    }
}

// AI Assistant Functions
async function callAI(systemPrompt, userPrompt) {
    const provider = settings.aiProvider || 'gemini';

    switch (provider) {
        case 'openai':
            return await callOpenAI(systemPrompt, userPrompt);
        case 'gemini':
            return await callGemini(systemPrompt, userPrompt);
        case 'groq':
            return await callGroq(systemPrompt, userPrompt);
        case 'anthropic':
            return await callAnthropic(systemPrompt, userPrompt);
        default:
            return await callGemini(systemPrompt, userPrompt);
    }
}

async function callOpenAI(systemPrompt, userPrompt) {
    if (!settings.openaiApiKey) {
        alert('⚠️ Please add your OpenAI API key in Settings first!');
        return null;
    }

    try {
        // Use CORS proxy for OpenAI API
        const response = await fetch('https://cors-anywhere.herokuapp.com/https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.openaiApiKey}`,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        alert(`❌ OpenAI Error: ${error.message}\n\nNote: OpenAI has CORS restrictions. Try using Gemini instead (Settings → AI Provider → Gemini)`);
        return null;
    }
}

async function callGemini(systemPrompt, userPrompt) {
    if (!settings.geminiApiKey) {
        alert('⚠️ Please add your Gemini API key in Settings first!');
        return null;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${settings.geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\n${userPrompt}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Gemini API request failed');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        alert(`❌ Gemini Error: ${error.message}`);
        return null;
    }
}

async function callGroq(systemPrompt, userPrompt) {
    if (!settings.groqApiKey) {
        alert('⚠️ Please add your Groq API key in Settings first!');
        return null;
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.groqApiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Groq API request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        alert(`❌ Groq Error: ${error.message}`);
        return null;
    }
}

async function callAnthropic(systemPrompt, userPrompt) {
    if (!settings.anthropicApiKey) {
        alert('⚠️ Please add your Anthropic API key in Settings first!');
        return null;
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': settings.anthropicApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Anthropic API request failed');
        }

        const data = await response.json();
        return data.content[0].text;
    } catch (error) {
        alert(`❌ Anthropic Error: ${error.message}`);
        return null;
    }
}

// Show AI menu for a task
window.showAIMenu = async function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    const choice = await showCustomModal(
        '🤖 AI Assistant',
        `AI Assistant for: "${task.title}"\n\nChoose an action:\n1 - ADHD-Friendly Breakdown (with energy levels & tips)\n2 - Fuzzy Breakdown (for overwhelming/vague tasks)\n3 - Simple Breakdown (quick subtasks)\n4 - Rephrase as action-based\n\nEnter 1-4:`
    );

    if (choice === '1') {
        aiADHDBreakdown(section, groupIndex, taskIndex);
    } else if (choice === '2') {
        aiFuzzyBreakdown(section, groupIndex, taskIndex);
    } else if (choice === '3') {
        aiBreakdownTask(section, groupIndex, taskIndex);
    } else if (choice === '4') {
        aiRephraseTask(section, groupIndex, taskIndex);
    }
}

// ADHD-Friendly Breakdown with energy levels and tips
async function aiADHDBreakdown(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];

    // Gather context
    const blockers = await showCustomModal(
        '💭 What\'s Blocking You?',
        `Task: "${task.title}"\n\nWhat's blocking you from starting?\n(e.g., "not sure where to begin", "need to find files", "too overwhelming")\n\n(Optional - leave blank to skip)`
    );
    if (blockers === null) return;

    const currentState = await showCustomModal(
        '📍 Current State',
        `What's your current state/context?\n(e.g., "have all materials ready", "just starting", "halfway done")\n\n(Optional - leave blank to skip)`
    );
    if (currentState === null) return;

    const systemPrompt = `You are an ADHD-specialized task coach. Break down tasks into ADHD-friendly steps that:
- Start with the ABSOLUTE EASIEST step to build momentum
- Address blockers first (not prep work)
- Minimize decision fatigue
- Are immediately actionable
- Include energy level (low/medium/high) and time estimate
- Provide ADHD-specific tips for each step

Return a JSON array of objects with this structure:
[{
  "step": "Action step description",
  "energy": "low|medium|high",
  "timeEstimate": "5-10 min",
  "adhdTip": "Helpful ADHD-specific tip"
}]

Example:
[{
  "step": "Open document and write one sentence",
  "energy": "low",
  "timeEstimate": "2 min",
  "adhdTip": "Start with literally anything - even 'I am writing this' counts"
}]`;

    const contextParts = [];
    if (blockers && blockers.trim()) contextParts.push(`Blocker: ${blockers.trim()}`);
    if (currentState && currentState.trim()) contextParts.push(`Current state: ${currentState.trim()}`);
    const context = contextParts.length > 0 ? `\n\n${contextParts.join('\n')}` : '';

    const userPrompt = `Break down this task into ADHD-friendly steps:\n"${task.title}"${context}`;

    alert('🤖 AI is thinking...');

    const response = await callAI(systemPrompt, userPrompt);
    if (!response) return;

    try {
        const steps = extractJSON(response);

        // Format preview with energy levels and tips
        const preview = steps.map((s, i) =>
            `${i + 1}. [${s.energy?.toUpperCase()}] ${s.step}\n   ⏱ ${s.timeEstimate}\n   💡 ${s.adhdTip}`
        ).join('\n\n');

        const userInput = await showCustomModal(
            '✨ AI Suggestions',
            `AI suggests these ADHD-friendly steps:\n\n${preview}\n\nEdit if needed, or click Submit to apply:`
        );

        if (userInput === null) return;

        // Convert to subtasks (simplified for now)
        const finalSubtasks = steps.map(s => ({
            title: `[${s.energy}] ${s.step} (${s.timeEstimate})`,
            completed: false
        }));

        if (finalSubtasks.length > 0) {
            task.subtasks = finalSubtasks;
            saveData();
            renderTasks();
            alert('✅ ADHD-friendly breakdown added!');
        }
    } catch (error) {
        alert('❌ Error parsing AI response. Using fallback pattern...');
        // Fallback to simple breakdown
        aiBreakdownTask(section, groupIndex, taskIndex);
    }
}

// Fuzzy Breakdown for vague/overwhelming tasks
async function aiFuzzyBreakdown(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];

    // 5-question flow
    const q1 = await showCustomModal('❓ Question 1/5', `Task: "${task.title}"\n\nWhat's the ideal outcome? What does "done" look like?`);
    if (q1 === null) return;

    const q2 = await showCustomModal('❓ Question 2/5', `What's blocking you or making this feel overwhelming?`);
    if (q2 === null) return;

    const q3 = await showCustomModal('❓ Question 3/5', `What information or resources do you already have?`);
    if (q3 === null) return;

    const q4 = await showCustomModal('❓ Question 4/5', `Who else is involved or needs to be consulted?`);
    if (q4 === null) return;

    const q5 = await showCustomModal('❓ Question 5/5', `How urgent is this? Any specific deadlines?`);
    if (q5 === null) return;

    const systemPrompt = `You are an ADHD task coach specializing in breaking down vague, overwhelming tasks. Based on the user's answers, generate 4-6 concrete, actionable tasks.

For each task, include:
- Task type (communication, research, decision, cleanup, action)
- Energy level (low/medium/high)
- Time estimate
- Emotional weight (light/moderate/heavy)
- Dependencies

Return JSON:
[{
  "task": "Specific action step",
  "type": "communication|research|decision|cleanup|action",
  "energy": "low|medium|high",
  "timeEstimate": "10 min",
  "emotionalWeight": "light|moderate|heavy",
  "dependency": "depends on..." or null
}]`;

    const userPrompt = `Original task: "${task.title}"

Outcome: ${q1}
Blockers: ${q2}
Existing info: ${q3}
People involved: ${q4}
Urgency: ${q5}

Generate actionable tasks that address the blockers first and build momentum.`;

    alert('🤖 AI is analyzing your answers...');

    const response = await callAI(systemPrompt, userPrompt);
    if (!response) return;

    try {
        const tasks = extractJSON(response);

        const preview = tasks.map((t, i) =>
            `${i + 1}. [${t.type}] ${t.task}\n   Energy: ${t.energy} | Time: ${t.timeEstimate} | Weight: ${t.emotionalWeight}`
        ).join('\n\n');

        const userInput = await showCustomModal(
            '✨ AI Suggestions',
            `Based on your answers, AI suggests:\n\n${preview}\n\nEdit if needed, or click Submit to apply:`
        );

        if (userInput === null) return;

        const finalSubtasks = tasks.map(t => ({
            title: `[${t.type}] ${t.task} (${t.timeEstimate})`,
            completed: false
        }));

        if (finalSubtasks.length > 0) {
            task.subtasks = finalSubtasks;
            saveData();
            renderTasks();
            alert('✅ Fuzzy breakdown complete!');
        }
    } catch (error) {
        console.error('Fuzzy breakdown error:', error);
        console.log('AI Response:', response);
        alert(`❌ Error parsing AI response: ${error.message}\n\nCheck browser console for details or try again.`);
    }
}

// AI Breakdown: Break task into subtasks (simple version)
async function aiBreakdownTask(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];

    const systemPrompt = `You are a task management assistant. Break down tasks into 3-5 clear, actionable subtasks. Return ONLY a JSON array of strings, no other text. Example: ["Subtask 1", "Subtask 2", "Subtask 3"]`;

    const userPrompt = `Break down this task into subtasks:\n"${task.title}"`;

    alert('🤖 AI is thinking...');

    const response = await callAI(systemPrompt, userPrompt);
    if (!response) return;

    try {
        const subtasks = extractJSON(response);

        // Show preview to user
        const preview = subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n');
        const userInput = await showCustomModal(
            '✨ AI Suggestions',
            `AI suggests these subtasks:\n\n${preview}\n\nEdit if needed (one per line), or click Submit to apply:`,
            preview
        );

        if (userInput === null) return; // Cancelled

        // Parse user's final input
        const finalSubtasks = userInput.trim().split('\n')
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(line => line.length > 0)
            .map(title => ({ title, completed: false }));

        if (finalSubtasks.length > 0) {
            task.subtasks = finalSubtasks;
            saveData();
            renderTasks();
            alert('✅ Subtasks added!');
        }
    } catch (error) {
        console.error('Simple breakdown error:', error);
        console.log('AI Response:', response);
        alert(`❌ Error parsing AI response: ${error.message}\n\nCheck browser console for details or try again.`);
    }
}

// AI Rephrase: Make task more action-oriented
async function aiRephraseTask(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];

    // Ask for additional context
    const additionalContext = await showCustomModal(
        '📝 Additional Context',
        `Task: "${task.title}"\n\nIs there any additional context I should know?\n\n(Optional - leave blank to skip, or add details about goals, constraints, deadlines, etc.)`
    );

    if (additionalContext === null) return; // Cancelled

    const contextNote = additionalContext && additionalContext.trim()
        ? `\n\nAdditional context: ${additionalContext.trim()}`
        : '';

    const systemPrompt = `You are an ADHD-specialized task coach. Rephrase tasks to be IMMEDIATELY ACTIONABLE and concrete. Rules:

1. Start with a SPECIFIC action verb (Open, Send, Call, Write, Review, Schedule, etc.)
2. Be ultra-specific - no vague language
3. Focus on the NEXT PHYSICAL ACTION, not the outcome
4. Keep it SHORT and clear (under 10 words if possible)
5. Remove abstract/overwhelming language
6. Make it something you can START in under 2 minutes

BAD (vague/overwhelming): "Work on proposal"
GOOD (concrete/actionable): "Open proposal doc and write intro paragraph"

BAD: "Handle email backlog"
GOOD: "Reply to the 3 oldest unread emails"

BAD: "Plan the event"
GOOD: "List 5 tasks needed for the event"

Return ONLY the rephrased task text, no quotes or extra text.`;

    const userPrompt = `Rephrase this task to be ADHD-friendly and immediately actionable:\n"${task.title}"${contextNote}`;

    alert('🤖 AI is thinking...');

    const response = await callAI(systemPrompt, userPrompt);
    if (!response) return;

    // Show preview to user
    const userInput = await showCustomModal(
        '✨ AI Suggestion',
        `AI suggests:\n\n"${response}"\n\nEdit if needed, or click Submit to apply:`,
        response
    );

    if (userInput === null) return; // Cancelled
    if (userInput.trim()) {
        task.title = userInput.trim();
        saveData();
        renderTasks();
        alert('✅ Task rephrased!');
    }
}

// AI Breakdown Project: Break project into tasks
window.aiBreakdownProject = async function(section, groupIndex) {
    const group = taskData[section][groupIndex];

    const systemPrompt = `You are a project management assistant. Break down projects into 5-8 clear, actionable tasks. Return ONLY a JSON array of strings, no other text. Example: ["Task 1", "Task 2", "Task 3"]`;

    const userPrompt = `Break down this project into tasks:\n"${group.groupName}"`;

    alert('🤖 AI is thinking...');

    const response = await callAI(systemPrompt, userPrompt);
    if (!response) return;

    try {
        const tasks = extractJSON(response);

        // Show preview to user
        const preview = tasks.map((t, i) => `${i + 1}. ${t}`).join('\n');
        const userInput = await showCustomModal(
            '✨ AI Suggestions',
            `AI suggests these tasks for "${group.groupName}":\n\n${preview}\n\nEdit if needed (one per line), or click Submit to apply:`,
            preview
        );

        if (userInput === null) return; // Cancelled

        // Parse user's final input
        const finalTasks = userInput.trim().split('\n')
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(line => line.length > 0)
            .map(title => ({ title, completed: false }));

        if (finalTasks.length > 0) {
            // Add tasks to the project
            group.tasks.push(...finalTasks);
            saveData();
            renderTasks();
            updateStats();
            updateProgress();
            alert('✅ Tasks added to project!');
        }
    } catch (error) {
        console.error('Project breakdown error:', error);
        console.log('AI Response:', response);
        alert(`❌ Error parsing AI response: ${error.message}\n\nCheck browser console for details or try again.`);
    }
}

// Initialize on load
init();
