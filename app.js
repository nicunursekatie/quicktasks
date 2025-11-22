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
    aiProvider: 'gemini'
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
                <button class="ai-btn" onclick="showAIMenu('${section}', ${groupIndex}, ${taskIndex})" title="AI Assistant">✨</button>
                <button class="edit-btn" onclick="editTask('${section}', ${groupIndex}, ${taskIndex})" title="Edit task">✏️</button>
                <button class="move-btn" onclick="moveTask('${section}', ${groupIndex}, ${taskIndex})" title="Move to ${section === 'today' ? 'Ongoing' : 'Today'}">${section === 'today' ? '📅' : '⚡'}</button>
                <button class="delete-btn" onclick="deleteTask('${section}', ${groupIndex}, ${taskIndex})" title="Delete task">🗑️</button>
            </div>
        </div>
    `;
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

    if (openaiInput) settings.openaiApiKey = openaiInput.value.trim();
    if (geminiInput) settings.geminiApiKey = geminiInput.value.trim();

    saveData();
    alert('✓ API key saved!');
}

function loadOpenAIKey() {
    const openaiInput = document.getElementById('openaiApiKey');
    const geminiInput = document.getElementById('geminiApiKey');
    const providerSelect = document.getElementById('aiProvider');

    if (openaiInput && settings.openaiApiKey) {
        openaiInput.value = settings.openaiApiKey;
    }
    if (geminiInput && settings.geminiApiKey) {
        geminiInput.value = settings.geminiApiKey;
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

// AI Assistant Functions
async function callAI(systemPrompt, userPrompt) {
    const provider = settings.aiProvider || 'openai';

    if (provider === 'openai') {
        return await callOpenAI(systemPrompt, userPrompt);
    } else {
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

// Show AI menu for a task
window.showAIMenu = function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    const choice = prompt(
        `AI Assistant for: "${task.title}"\n\n` +
        `Choose an action:\n` +
        `1 - Break down into subtasks\n` +
        `2 - Rephrase as action-based\n\n` +
        `Enter 1 or 2:`
    );

    if (choice === '1') {
        aiBreakdownTask(section, groupIndex, taskIndex);
    } else if (choice === '2') {
        aiRephraseTask(section, groupIndex, taskIndex);
    }
}

// AI Breakdown: Break task into subtasks
async function aiBreakdownTask(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];

    const systemPrompt = `You are a task management assistant. Break down tasks into 3-5 clear, actionable subtasks. Return ONLY a JSON array of strings, no other text. Example: ["Subtask 1", "Subtask 2", "Subtask 3"]`;

    const userPrompt = `Break down this task into subtasks:\n"${task.title}"`;

    alert('🤖 AI is thinking...');

    const response = await callAI(systemPrompt, userPrompt);
    if (!response) return;

    try {
        const subtasks = JSON.parse(response);

        // Show preview to user
        const preview = subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n');
        const userInput = prompt(
            `AI suggests these subtasks:\n\n${preview}\n\n` +
            `Edit if needed (one per line), or click OK to apply:`
            , preview
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
        alert('❌ Error parsing AI response. Please try again.');
    }
}

// AI Rephrase: Make task more action-oriented
async function aiRephraseTask(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];

    // Ask for additional context
    const additionalContext = prompt(
        `Task: "${task.title}"\n\n` +
        `Is there any additional context I should know?\n\n` +
        `(Optional - just click OK to skip, or add details about goals, constraints, deadlines, etc.)`
    );

    if (additionalContext === null) return; // Cancelled

    const contextNote = additionalContext && additionalContext.trim()
        ? `\n\nAdditional context: ${additionalContext.trim()}`
        : '';

    const systemPrompt = `You are a productivity coach. Rephrase tasks to be action-oriented, starting with strong verbs. Make them clear, specific, and motivating. Return ONLY the rephrased task text, no quotes or extra text.`;

    const userPrompt = `Rephrase this task to be more action-oriented:\n"${task.title}"${contextNote}`;

    alert('🤖 AI is thinking...');

    const response = await callAI(systemPrompt, userPrompt);
    if (!response) return;

    // Show preview to user
    const userInput = prompt(
        `AI suggests:\n\n"${response}"\n\n` +
        `Edit if needed, or click OK to apply:`
        , response
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
        const tasks = JSON.parse(response);

        // Show preview to user
        const preview = tasks.map((t, i) => `${i + 1}. ${t}`).join('\n');
        const userInput = prompt(
            `AI suggests these tasks for "${group.groupName}":\n\n${preview}\n\n` +
            `Edit if needed (one per line), or click OK to apply:`
            , preview
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
        alert('❌ Error parsing AI response. Please try again.');
    }
}

// Initialize on load
init();
