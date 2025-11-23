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
function loadTaskData() {
    try {
        const savedData = localStorage.getItem('taskData');
        if (savedData) {
            return JSON.parse(savedData);
        }
    } catch (error) {
        console.error('Error loading task data:', error);
        // Try to restore from backup
        const backups = JSON.parse(localStorage.getItem('taskData_backups') || '[]');
        if (backups.length > 0) {
            console.warn('Task data corrupted, attempting to restore from backup...');
            const latestBackup = backups[backups.length - 1];
            if (latestBackup && latestBackup.taskData) {
                return latestBackup.taskData;
            }
        }
    }
    return initialData;
}

let taskData = loadTaskData();
let archivedTasks = JSON.parse(localStorage.getItem('archivedTasks')) || [];
let settings = JSON.parse(localStorage.getItem('settings')) || {
    darkMode: false,
    showCompleted: true,
    openaiApiKey: '',
    geminiApiKey: '',
    groqApiKey: '',
    anthropicApiKey: '',
    aiProvider: 'gemini',
    focusAlertInterval: 10, // minutes: 5, 10, or 15
    activeTask: null // { section, groupIndex, taskIndex, websiteUrl, alertInterval }
};

let currentUser = null;
let unsubscribe = null;

// Focus mode timer
let focusTimer = null;
let focusAlertInterval = null;

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
    // Clean the response
    let cleaned = response.trim();

    // Try direct parse first
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Look for JSON in markdown code blocks
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
            try {
                return JSON.parse(codeBlockMatch[1].trim());
            } catch (e2) {
                // Continue to next attempt
            }
        }

        // Look for JSON array - be greedy and get the largest valid array
        const arrayMatches = cleaned.match(/\[[\s\S]*\]/g);
        if (arrayMatches) {
            // Try each match from longest to shortest
            for (const match of arrayMatches.sort((a, b) => b.length - a.length)) {
                try {
                    return JSON.parse(match.trim());
                } catch (e) {
                    continue;
                }
            }
        }

        // Look for JSON object
        const objectMatches = cleaned.match(/\{[\s\S]*\}/g);
        if (objectMatches) {
            for (const match of objectMatches.sort((a, b) => b.length - a.length)) {
                try {
                    return JSON.parse(match.trim());
                } catch (e) {
                    continue;
                }
            }
        }

        throw new Error('Could not extract valid JSON from response. Check console for raw response.');
    }
}

// Smart date parser for natural language dates
function parseNaturalDate(input) {
    if (!input || !input.trim()) return null;

    const text = input.toLowerCase().trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Direct date input (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        return input;
    }

    // Today
    if (text === 'today') {
        return formatDate(today);
    }

    // Tomorrow
    if (text === 'tomorrow' || text === 'tmr' || text === 'tom') {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return formatDate(tomorrow);
    }

    // Yesterday
    if (text === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return formatDate(yesterday);
    }

    // In X days
    const inDaysMatch = text.match(/^in (\d+) days?$/);
    if (inDaysMatch) {
        const date = new Date(today);
        date.setDate(today.getDate() + parseInt(inDaysMatch[1]));
        return formatDate(date);
    }

    // Next/This weekday
    const weekdayMatch = text.match(/^(next|this) (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
    if (weekdayMatch) {
        const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekdayMatch[2]);
        const currentDay = today.getDay();
        const isNext = weekdayMatch[1] === 'next';

        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0 || isNext) {
            daysToAdd += 7;
        }

        const date = new Date(today);
        date.setDate(today.getDate() + daysToAdd);
        return formatDate(date);
    }

    // Next week
    if (text === 'next week') {
        const date = new Date(today);
        date.setDate(today.getDate() + 7);
        return formatDate(date);
    }

    // Next month
    if (text === 'next month') {
        const date = new Date(today);
        date.setMonth(today.getMonth() + 1);
        return formatDate(date);
    }

    // Specific weekday (assumes next occurrence)
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (weekdays.includes(text)) {
        const targetDay = weekdays.indexOf(text) + 1; // Monday = 1
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;

        const date = new Date(today);
        date.setDate(today.getDate() + daysToAdd);
        return formatDate(date);
    }

    return null;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialize
function init() {
    updateDateStamp();
    applyTheme();
    renderTasks();
    updateStats();
    updateProgress();
    loadOpenAIKey();
    initFocusMode();
    requestNotificationPermission();
}

// Request notification permission for background alerts
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        // Only ask once, and let user know why
        setTimeout(() => {
            const shouldAsk = confirm(
                '🔔 Focus Mode Alerts\n\n' +
                'Would you like to enable browser notifications?\n\n' +
                'This allows focus alerts to work even when this tab is in the background.\n\n' +
                'Click OK to enable, or Cancel to skip (alerts will only work when tab is active).'
            );
            
            if (shouldAsk) {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        console.log('✅ Notification permission granted');
                    } else {
                        console.log('❌ Notification permission denied');
                    }
                });
            }
        }, 2000); // Wait 2 seconds after page load
    }
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
    
    // Attach drag-and-drop event listeners after rendering both sections
    attachDragAndDropListeners();
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
            <div class="task-group" draggable="true" data-section="${section}" data-group-index="${groupIndex}">
                <div class="group-header">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                        <h2 onclick="editGroupName('${section}', ${groupIndex})" style="cursor: pointer; flex: 1;" title="Click to edit project name">
                            ${escapeHtml(group.groupName)}
                            <span style="font-size: 12px; color: var(--text-muted); font-weight: 400;">
                                (${completedTasks}/${totalTasks})
                            </span>
                        </h2>
                    </div>
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
                <div class="task-list" data-section="${section}" data-group-index="${groupIndex}">
                    ${group.tasks.map((task, taskIndex) => renderTask(section, groupIndex, taskIndex, task)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Drag and Drop functionality
let draggedElement = null;
let draggedType = null; // 'task' or 'group'
let isDragging = false; // Track if we're currently dragging
window.isDragging = false; // Make it accessible from inline handlers

// Track if listeners are attached to avoid duplicates
let dragListenersAttached = false;

function attachDragAndDropListeners() {
    if (dragListenersAttached) {
        // Clean up old listeners by removing and re-adding
        dragListenersAttached = false;
    }
    
    // Attach listeners to task groups
    document.querySelectorAll('.task-group').forEach(group => {
        group.addEventListener('dragstart', handleGroupDragStart);
        group.addEventListener('dragend', handleDragEnd);
        group.addEventListener('dragover', handleDragOver);
        group.addEventListener('drop', handleGroupDrop);
        group.addEventListener('dragleave', handleDragLeave);
    });
    
    // Attach listeners to task items
    document.querySelectorAll('.task-item').forEach(task => {
        task.addEventListener('dragstart', handleTaskDragStart);
        task.addEventListener('dragend', handleDragEnd);
        task.addEventListener('dragover', handleDragOver);
        task.addEventListener('drop', handleTaskDrop);
        task.addEventListener('dragleave', handleDragLeave);
    });
    
    // Attach listeners to task lists (drop zones for tasks)
    document.querySelectorAll('.task-list').forEach(list => {
        list.addEventListener('dragover', handleDragOver);
        list.addEventListener('drop', handleTaskDrop);
        list.addEventListener('dragleave', handleDragLeave);
    });
    
    // Attach listeners to section containers (drop zones for groups)
    const todayContainer = document.getElementById('todayTasks');
    const longtermContainer = document.getElementById('longtermTasks');
    
    if (todayContainer && !todayContainer.hasAttribute('data-drag-listeners')) {
        todayContainer.setAttribute('data-drag-listeners', 'true');
        todayContainer.addEventListener('dragover', handleSectionDragOver);
        todayContainer.addEventListener('drop', handleSectionDrop);
        todayContainer.addEventListener('dragleave', handleDragLeave);
    }
    
    if (longtermContainer && !longtermContainer.hasAttribute('data-drag-listeners')) {
        longtermContainer.setAttribute('data-drag-listeners', 'true');
        longtermContainer.addEventListener('dragover', handleSectionDragOver);
        longtermContainer.addEventListener('drop', handleSectionDrop);
        longtermContainer.addEventListener('dragleave', handleDragLeave);
    }
    
    dragListenersAttached = true;
}

function handleSectionDragOver(e) {
    if (draggedType !== 'group') return false;
    
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over-list');
    return false;
}

function handleSectionDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedType !== 'group' || !draggedElement) return false;
    
    const dropContainer = this;
    const dropSection = dropContainer.id === 'todayTasks' ? 'today' : 'longterm';
    const draggedSection = draggedElement.dataset.section;
    const draggedGroupIndex = parseInt(draggedElement.dataset.groupIndex);
    
    if (draggedSection === dropSection) {
        // Moving to end of section
        const draggedGroup = taskData[draggedSection][draggedGroupIndex];
        taskData[draggedSection].splice(draggedGroupIndex, 1);
        taskData[dropSection].push(draggedGroup);
        
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }
    
    this.classList.remove('drag-over-list');
    return false;
}

function handleGroupDragStart(e) {
    // Allow dragging from drag handle or anywhere except buttons
    const isButton = e.target.tagName === 'BUTTON' || e.target.closest('button');
    const isInActions = e.target.closest('.group-actions');
    
    // Allow dragging from h2 or drag handle, but not from buttons
    if (isButton || isInActions) {
        e.stopPropagation();
        return false;
    }
    
    isDragging = true;
    window.isDragging = true;
    draggedElement = this;
    draggedType = 'group';
    this.classList.add('dragging');
    
    try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.groupIndex || '');
    } catch (err) {
        // Ignore data transfer errors
    }
    
    return true;
}

function handleTaskDragStart(e) {
    // Allow dragging from drag handle or anywhere except buttons/inputs
    const isButton = e.target.tagName === 'BUTTON' || e.target.closest('button');
    const isInput = e.target.tagName === 'INPUT' || e.target.closest('input');
    const isCheckbox = e.target.type === 'checkbox' || e.target.closest('input[type="checkbox"]');
    const isInActions = e.target.closest('.task-actions');
    
    if (isButton || isInput || isCheckbox || isInActions) {
        e.stopPropagation();
        return false;
    }
    
    isDragging = true;
    window.isDragging = true;
    draggedElement = this;
    draggedType = 'task';
    this.classList.add('dragging');
    
    try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.taskIndex || '');
    } catch (err) {
        // Ignore data transfer errors
    }
    
    return true;
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    // Add drop zone highlight
    if (draggedType === 'task' && (this.classList.contains('task-item') || this.classList.contains('task-list'))) {
        if (this.classList.contains('task-item')) {
            this.classList.add('drag-over');
        } else if (this.classList.contains('task-list')) {
            this.classList.add('drag-over-list');
        }
    } else if (draggedType === 'group' && this.classList.contains('task-group')) {
        this.classList.add('drag-over');
    }
    
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over', 'drag-over-list');
}

function handleGroupDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedType !== 'group' || !draggedElement) return false;
    
    const dropTarget = this;
    const draggedSection = draggedElement.dataset.section;
    const draggedGroupIndex = parseInt(draggedElement.dataset.groupIndex);
    const dropSection = dropTarget.dataset.section;
    const dropGroupIndex = parseInt(dropTarget.dataset.groupIndex);
    
    // Validate indices
    if (isNaN(draggedGroupIndex) || isNaN(dropGroupIndex)) {
        console.error('Invalid group indices:', { draggedGroupIndex, dropGroupIndex });
        return false;
    }
    
    // Validate data exists
    if (!taskData[draggedSection] || draggedGroupIndex >= taskData[draggedSection].length) {
        console.error('Invalid drag source:', { draggedSection, draggedGroupIndex });
        return false;
    }
    
    if (!taskData[dropSection] || dropGroupIndex >= taskData[dropSection].length) {
        console.error('Invalid drop target:', { dropSection, dropGroupIndex });
        return false;
    }
    
    if (draggedSection === dropSection && draggedGroupIndex !== dropGroupIndex) {
        try {
            // Reorder groups within same section
            // Get the group BEFORE modifying arrays
            const draggedGroup = taskData[draggedSection][draggedGroupIndex];
            
            if (!draggedGroup) {
                console.error('Could not find dragged group:', { draggedSection, draggedGroupIndex });
                return false;
            }
            
            // Make a deep copy to avoid reference issues
            const groupToMove = JSON.parse(JSON.stringify(draggedGroup));
            
            // Remove from original position
            taskData[draggedSection].splice(draggedGroupIndex, 1);
            
            // Calculate new index (adjust if dragging down)
            let newIndex = dropGroupIndex;
            if (draggedGroupIndex < dropGroupIndex) {
                newIndex = dropGroupIndex; // Already accounted for by removal
            } else {
                newIndex = dropGroupIndex;
            }
            
            // Ensure newIndex is valid
            newIndex = Math.max(0, Math.min(newIndex, taskData[dropSection].length));
            
            // Insert at new position
            taskData[dropSection].splice(newIndex, 0, groupToMove);
            
            saveData();
            renderTasks();
            updateStats();
            updateProgress();
        } catch (error) {
            console.error('Error during group drop:', error);
            // Re-render to restore UI state
            renderTasks();
            alert('An error occurred while moving the group. Please try again.');
            return false;
        }
    }
    
    this.classList.remove('drag-over');
    return false;
}

function handleTaskDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedType !== 'task' || !draggedElement) return false;
    
    const dropTarget = this;
    const draggedSection = draggedElement.dataset.section;
    const draggedGroupIndex = parseInt(draggedElement.dataset.groupIndex);
    const draggedTaskIndex = parseInt(draggedElement.dataset.taskIndex);
    
    // Validate indices
    if (isNaN(draggedGroupIndex) || isNaN(draggedTaskIndex)) {
        console.error('Invalid drag indices:', { draggedGroupIndex, draggedTaskIndex });
        return false;
    }
    
    // Validate data exists
    if (!taskData[draggedSection] || 
        !taskData[draggedSection][draggedGroupIndex] ||
        !taskData[draggedSection][draggedGroupIndex].tasks ||
        draggedTaskIndex >= taskData[draggedSection][draggedGroupIndex].tasks.length) {
        console.error('Invalid drag source:', { draggedSection, draggedGroupIndex, draggedTaskIndex });
        return false;
    }
    
    // Determine drop location
    let dropSection, dropGroupIndex, dropTaskIndex;
    
    if (dropTarget.classList.contains('task-item')) {
        // Dropping on another task
        dropSection = dropTarget.dataset.section;
        dropGroupIndex = parseInt(dropTarget.dataset.groupIndex);
        dropTaskIndex = parseInt(dropTarget.dataset.taskIndex);
    } else if (dropTarget.classList.contains('task-list')) {
        // Dropping on task list (end of group)
        dropSection = dropTarget.dataset.section;
        dropGroupIndex = parseInt(dropTarget.dataset.groupIndex);
        // Validate drop target exists
        if (!taskData[dropSection] || !taskData[dropSection][dropGroupIndex]) {
            console.error('Invalid drop target:', { dropSection, dropGroupIndex });
            return false;
        }
        dropTaskIndex = taskData[dropSection][dropGroupIndex].tasks.length;
    } else {
        return false;
    }
    
    // Validate drop indices
    if (isNaN(dropGroupIndex) || isNaN(dropTaskIndex)) {
        console.error('Invalid drop indices:', { dropGroupIndex, dropTaskIndex });
        return false;
    }
    
    // Validate drop target exists
    if (!taskData[dropSection] || !taskData[dropSection][dropGroupIndex]) {
        console.error('Invalid drop target data:', { dropSection, dropGroupIndex });
        return false;
    }
    
    // Get the dragged task BEFORE modifying arrays
    const draggedTask = taskData[draggedSection][draggedGroupIndex].tasks[draggedTaskIndex];
    
    // Validate we got a valid task
    if (!draggedTask) {
        console.error('Could not find dragged task:', { draggedSection, draggedGroupIndex, draggedTaskIndex });
        return false;
    }
    
    // Make a deep copy of the task to avoid reference issues
    const taskToMove = JSON.parse(JSON.stringify(draggedTask));
    
    try {
        // If moving within the same group, just reorder
        if (draggedSection === dropSection && draggedGroupIndex === dropGroupIndex) {
            // Remove from original position
            taskData[draggedSection][draggedGroupIndex].tasks.splice(draggedTaskIndex, 1);
            
            // Calculate new index (adjust if dragging down)
            let newIndex = dropTaskIndex;
            if (draggedTaskIndex < dropTaskIndex) {
                newIndex = dropTaskIndex - 1; // Account for removal
            } else {
                newIndex = dropTaskIndex;
            }
            
            // Ensure newIndex is valid
            newIndex = Math.max(0, Math.min(newIndex, taskData[dropSection][dropGroupIndex].tasks.length));
            
            // Insert at new position
            taskData[dropSection][dropGroupIndex].tasks.splice(newIndex, 0, taskToMove);
        } else {
            // Moving to a different group - remove from source first
            taskData[draggedSection][draggedGroupIndex].tasks.splice(draggedTaskIndex, 1);
            
            // Ensure dropTaskIndex is valid
            const maxIndex = taskData[dropSection][dropGroupIndex].tasks.length;
            const newIndex = Math.max(0, Math.min(dropTaskIndex, maxIndex));
            
            // Insert at new position
            taskData[dropSection][dropGroupIndex].tasks.splice(newIndex, 0, taskToMove);
        }
        
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    } catch (error) {
        console.error('Error during task drop:', error);
        // Re-render to restore UI state
        renderTasks();
        alert('An error occurred while moving the task. Please try again.');
        return false;
    }
    
    // Clean up
    if (dropTarget.classList.contains('task-item')) {
        dropTarget.classList.remove('drag-over');
    } else {
        dropTarget.classList.remove('drag-over-list');
    }
    
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Remove all drag-over classes
    document.querySelectorAll('.drag-over, .drag-over-list').forEach(el => {
        el.classList.remove('drag-over', 'drag-over-list');
    });
    
    // Reset drag state after a short delay to allow drop handlers to run
    setTimeout(() => {
        isDragging = false;
        window.isDragging = false;
        draggedElement = null;
        draggedType = null;
    }, 100);
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
        <div class="task-item ${task.completed ? 'checked' : ''} ${settings.activeTask && settings.activeTask.section === section && settings.activeTask.groupIndex === groupIndex && settings.activeTask.taskIndex === taskIndex ? 'focused-task' : ''}" 
             draggable="true" 
             data-section="${section}" 
             data-group-index="${groupIndex}" 
             data-task-index="${taskIndex}">
            <span class="drag-handle-task" title="Drag to reorder" style="user-select: none;">⋮⋮</span>
            <input type="checkbox"
                   class="task-checkbox"
                   ${task.completed ? 'checked' : ''}
                   onclick="toggleTask('${section}', ${groupIndex}, ${taskIndex})"
                   title="Mark as ${task.completed ? 'incomplete' : 'complete'}">
            <div class="task-content" onclick="if(!window.isDragging) editTask('${section}', ${groupIndex}, ${taskIndex})" style="cursor: pointer;">
                <div class="task-title">
                    ${task.emotionalWeight === 'light' ? '💨 ' : task.emotionalWeight === 'moderate' ? '⚖️ ' : task.emotionalWeight === 'heavy' ? '🎯 ' : ''}${escapeHtml(task.title)}
                    ${task.completed && task.actualMinutes && task.estimatedMinutes
                        ? `<span style="font-size: 12px; color: rgba(255,255,255,0.7); margin-left: 8px;">⏱️ ${task.actualMinutes}/${task.estimatedMinutes}min</span>`
                        : task.estimatedMinutes
                        ? `<span style="font-size: 12px; color: rgba(255,255,255,0.7); margin-left: 8px;">⏱️ ${task.estimatedMinutes}min</span>`
                        : ''
                    }
                    ${task.dueDate ? `<span style="font-size: 12px; color: rgba(255,255,255,0.7); margin-left: 8px;">📅 ${task.dueDate}</span>` : ''}
                </div>
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
                <button class="focus-btn ${settings.activeTask && settings.activeTask.section === section && settings.activeTask.groupIndex === groupIndex && settings.activeTask.taskIndex === taskIndex ? 'active' : ''}" 
                        onclick="toggleFocusTask('${section}', ${groupIndex}, ${taskIndex})" 
                        title="${settings.activeTask && settings.activeTask.section === section && settings.activeTask.groupIndex === groupIndex && settings.activeTask.taskIndex === taskIndex ? 'Stop focusing on this task' : 'Focus on this task (periodic alerts)'}">🎯</button>
                <button class="ai-btn" onclick="showAIMenu('${section}', ${groupIndex}, ${taskIndex})" title="AI Assistant">✨</button>
                <button class="edit-btn" onclick="editTask('${section}', ${groupIndex}, ${taskIndex})" title="Edit task">✏️</button>
                <button class="move-btn" onclick="moveTask('${section}', ${groupIndex}, ${taskIndex})" title="Move to ${section === 'today' ? 'Ongoing' : 'Today'}">${section === 'today' ? '📅' : '⚡'}</button>
                <button class="delete-btn" onclick="deleteTask('${section}', ${groupIndex}, ${taskIndex})" title="Delete task">🗑️</button>
            </div>
        </div>
    `;
}

// New Task Modal
window.showNewTaskModal = function() {
    // Populate project dropdown
    const select = document.getElementById('newTaskProject');
    select.innerHTML = '<option value="">-- No project --</option>';

    // Add Today projects
    taskData.today.forEach((group, index) => {
        const option = document.createElement('option');
        option.value = `today-${index}`;
        option.textContent = `⚡ ${group.groupName}`;
        select.appendChild(option);
    });

    // Add Long-term projects
    taskData.longterm.forEach((group, index) => {
        const option = document.createElement('option');
        option.value = `longterm-${index}`;
        option.textContent = `📅 ${group.groupName}`;
        select.appendChild(option);
    });

    // Reset form
    document.getElementById('newTaskTitle').value = '';
    document.querySelector('input[name="newTaskSection"][value="today"]').checked = true;
    select.value = '';
    document.getElementById('newTaskDueDate').value = '';
    document.getElementById('newTaskEstimate').value = '';
    document.getElementById('newTaskEmotionalWeight').value = '';

    // Show modal
    document.getElementById('newTaskModal').classList.add('active');
    const input = document.getElementById('newTaskTitle');
    input.focus();

    // Handle Enter key
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            submitNewTask();
            input.removeEventListener('keydown', handleKeyDown);
        } else if (e.key === 'Escape') {
            closeNewTaskModal();
            input.removeEventListener('keydown', handleKeyDown);
        }
    };
    input.addEventListener('keydown', handleKeyDown);
}

window.closeNewTaskModal = function() {
    document.getElementById('newTaskModal').classList.remove('active');
}

window.submitNewTask = function() {
    const title = document.getElementById('newTaskTitle').value.trim();
    if (!title) {
        alert('Please enter a task title');
        return;
    }

    const section = document.querySelector('input[name="newTaskSection"]:checked').value;
    const projectValue = document.getElementById('newTaskProject').value;
    const dueDateInput = document.getElementById('newTaskDueDate').value;
    const estimate = document.getElementById('newTaskEstimate').value;

    const newTask = {
        title: title,
        completed: false
    };

    // Parse natural language date
    if (dueDateInput) {
        const parsedDate = parseNaturalDate(dueDateInput);
        if (parsedDate) {
            newTask.dueDate = parsedDate;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateInput)) {
            newTask.dueDate = dueDateInput;
        }
    }

    if (estimate && parseInt(estimate) > 0) {
        newTask.estimatedMinutes = parseInt(estimate);
    }

    const emotionalWeight = document.getElementById('newTaskEmotionalWeight').value;
    if (emotionalWeight) {
        newTask.emotionalWeight = emotionalWeight;
    }

    if (projectValue) {
        // Add to existing project
        const [projectSection, projectIndex] = projectValue.split('-');
        taskData[projectSection][parseInt(projectIndex)].tasks.push(newTask);
    } else {
        // Add to "Quick Tasks" group or create it
        let quickGroup = taskData[section].find(g => g.groupName === 'Quick Tasks');
        if (!quickGroup) {
            quickGroup = { groupName: 'Quick Tasks', tasks: [] };
            taskData[section].unshift(quickGroup);
        }
        quickGroup.tasks.push(newTask);
    }

    saveData();
    renderTasks();
    updateStats();
    updateProgress();
    closeNewTaskModal();
}

// Toggle task completion
window.toggleTask = async function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];

    // If completing the task, prompt for actual time
    if (!task.completed) {
        task.completed = true;
        
        // Clear focus if completing the active task
        if (settings.activeTask &&
            settings.activeTask.section === section &&
            settings.activeTask.groupIndex === groupIndex &&
            settings.activeTask.taskIndex === taskIndex) {
            settings.activeTask = null;
            clearFocusTimer();
        }

        // Prompt for actual time if there's an estimate
        if (task.estimatedMinutes) {
            const actualTime = await showCustomModal(
                '⏱️ Time Tracking',
                `How long did "${task.title}" actually take?\n\nEstimated: ${task.estimatedMinutes} minutes`,
                task.estimatedMinutes.toString()
            );

            if (actualTime && parseInt(actualTime) > 0) {
                task.actualMinutes = parseInt(actualTime);

                // Show comparison
                const diff = task.actualMinutes - task.estimatedMinutes;
                const diffText = diff > 0
                    ? `${diff} min over estimate`
                    : diff < 0
                    ? `${Math.abs(diff)} min under estimate`
                    : 'Right on time!';

                const accuracy = diff === 0 ? '🎯' : Math.abs(diff) <= 5 ? '✅' : '📊';

                setTimeout(() => {
                    alert(`${accuracy} Task completed!\n\nEstimated: ${task.estimatedMinutes} min\nActual: ${task.actualMinutes} min\n${diffText}`);
                }, 100);
            }
        }
    } else {
        // Uncompleting - just toggle
        task.completed = false;
    }

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
        // Check if active task is in this group
        if (settings.activeTask &&
            settings.activeTask.section === section &&
            settings.activeTask.groupIndex === groupIndex) {
            settings.activeTask = null;
            clearFocusTimer();
        }
        
        taskData[section].splice(groupIndex, 1);
        
        // Adjust active task group index if deleting before it
        if (settings.activeTask &&
            settings.activeTask.section === section &&
            settings.activeTask.groupIndex > groupIndex) {
            settings.activeTask.groupIndex--;
        }
        
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }
}

// Add task to specific group (uses the new task modal)
window.addTaskToGroup = function(section, groupIndex) {
    showNewTaskModal();

    // Pre-select the section and project
    document.querySelector(`input[name="newTaskSection"][value="${section}"]`).checked = true;
    document.getElementById('newTaskProject').value = `${section}-${groupIndex}`;
}

// Task Edit Modal State
let currentEditTask = null;

// Edit task with modal
window.editTask = function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    currentEditTask = { section, groupIndex, taskIndex };

    // Populate modal
    document.getElementById('taskEditTitle').value = task.title;
    document.getElementById('taskEditDueDate').value = task.dueDate || '';
    document.getElementById('taskEditEstimate').value = task.estimatedMinutes || '';
    document.getElementById('taskEditEmotionalWeight').value = task.emotionalWeight || '';

    // Populate project dropdown
    const projectSelect = document.getElementById('taskEditProject');
    projectSelect.innerHTML = '';

    // Add all projects from both sections
    taskData.today.forEach((group, index) => {
        const option = document.createElement('option');
        option.value = `today-${index}`;
        option.textContent = `⚡ ${group.groupName}`;
        if (section === 'today' && index === groupIndex) {
            option.selected = true;
        }
        projectSelect.appendChild(option);
    });

    taskData.longterm.forEach((group, index) => {
        const option = document.createElement('option');
        option.value = `longterm-${index}`;
        option.textContent = `📅 ${group.groupName}`;
        if (section === 'longterm' && index === groupIndex) {
            option.selected = true;
        }
        projectSelect.appendChild(option);
    });

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

    // Update due date
    const newDueDate = document.getElementById('taskEditDueDate').value;
    if (newDueDate) {
        task.dueDate = newDueDate;
    } else {
        delete task.dueDate;
    }

    // Update estimated time
    const newEstimate = document.getElementById('taskEditEstimate').value;
    if (newEstimate && parseInt(newEstimate) > 0) {
        task.estimatedMinutes = parseInt(newEstimate);
    } else {
        delete task.estimatedMinutes;
    }

    // Update emotional weight
    const newEmotionalWeight = document.getElementById('taskEditEmotionalWeight').value;
    if (newEmotionalWeight) {
        task.emotionalWeight = newEmotionalWeight;
    } else {
        delete task.emotionalWeight;
    }

    // Check if project changed
    const selectedProject = document.getElementById('taskEditProject').value;
    const [newSection, newGroupIndex] = selectedProject.split('-');
    const movedProject = section !== newSection || groupIndex !== parseInt(newGroupIndex);

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

    // Move task to different project if changed
    if (movedProject) {
        // Remove from current project
        taskData[section][groupIndex].tasks.splice(taskIndex, 1);

        // Remove project if empty
        if (taskData[section][groupIndex].tasks.length === 0) {
            taskData[section].splice(groupIndex, 1);
        }

        // Add to new project
        taskData[newSection][parseInt(newGroupIndex)].tasks.push(task);
    }

    saveData();
    renderTasks();
    updateStats();
    updateProgress();
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
        // Check if this is the active focused task
        if (settings.activeTask &&
            settings.activeTask.section === section &&
            settings.activeTask.groupIndex === groupIndex &&
            settings.activeTask.taskIndex === taskIndex) {
            // Clear focus if deleting the active task
            settings.activeTask = null;
            clearFocusTimer();
        }
        
        taskData[section][groupIndex].tasks.splice(taskIndex, 1);
        if (taskData[section][groupIndex].tasks.length === 0) {
            taskData[section].splice(groupIndex, 1);
            
            // Adjust active task index if needed
            if (settings.activeTask && settings.activeTask.section === section && settings.activeTask.groupIndex === groupIndex) {
                settings.activeTask = null;
                clearFocusTimer();
            }
        } else {
            // Adjust active task index if deleting before it
            if (settings.activeTask &&
                settings.activeTask.section === section &&
                settings.activeTask.groupIndex === groupIndex &&
                settings.activeTask.taskIndex > taskIndex) {
                settings.activeTask.taskIndex--;
            }
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
// New Project Modal
let newProjectSection = null;

window.createNewGroup = function(section) {
    newProjectSection = section;
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectModal').classList.add('active');
    document.getElementById('newProjectName').focus();

    // Handle Enter key
    const input = document.getElementById('newProjectName');
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            submitNewProject();
            input.removeEventListener('keydown', handleKeyDown);
        } else if (e.key === 'Escape') {
            closeNewProjectModal();
            input.removeEventListener('keydown', handleKeyDown);
        }
    };
    input.addEventListener('keydown', handleKeyDown);
}

window.closeNewProjectModal = function() {
    document.getElementById('newProjectModal').classList.remove('active');
    newProjectSection = null;
}

window.submitNewProject = function() {
    const name = document.getElementById('newProjectName').value.trim();
    if (!name) {
        alert('Please enter a project name');
        return;
    }

    taskData[newProjectSection].push({
        groupName: name,
        tasks: []
    });

    saveData();
    renderTasks();
    updateStats();
    updateProgress();
    closeNewProjectModal();
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

// Archive functions
window.toggleArchive = function() {
    const panel = document.getElementById('archivePanel');
    const overlay = document.getElementById('overlay');
    panel.classList.toggle('open');
    overlay.classList.toggle('active');

    if (panel.classList.contains('open')) {
        renderArchive();
    }
}

window.archiveCompleted = function() {
    let archivedCount = 0;
    const timestamp = new Date().toISOString();

    // Go through all sections and groups
    ['today', 'longterm'].forEach(section => {
        taskData[section].forEach((group, groupIndex) => {
            // Find completed tasks
            const completedTasks = group.tasks.filter(task => task.completed);

            if (completedTasks.length > 0) {
                // Archive them with metadata
                completedTasks.forEach(task => {
                    archivedTasks.push({
                        ...task,
                        archivedDate: timestamp,
                        originalProject: group.groupName,
                        originalSection: section
                    });
                    archivedCount++;
                });

                // Remove completed tasks from the group
                group.tasks = group.tasks.filter(task => !task.completed);
            }
        });

        // Remove empty groups
        taskData[section] = taskData[section].filter(group => group.tasks.length > 0);
    });

    if (archivedCount > 0) {
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
        alert(`✅ Archived ${archivedCount} completed task${archivedCount === 1 ? '' : 's'}!`);
    } else {
        alert('No completed tasks to archive.');
    }
}

function renderArchive() {
    const container = document.getElementById('archiveContent');

    if (archivedTasks.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.7); padding: 40px;">No archived tasks yet.</p>';
        return;
    }

    // Group by date
    const groupedByDate = {};
    archivedTasks.forEach(task => {
        const date = new Date(task.archivedDate).toLocaleDateString();
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(task);
    });

    let html = '';
    Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
        html += `
            <div style="margin-bottom: 20px;">
                <h4 style="color: var(--text-primary); font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;">
                    📅 ${date}
                </h4>
        `;

        groupedByDate[date].forEach((task, index) => {
            html += `
                <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="color: var(--text-primary); font-size: 14px;">${escapeHtml(task.title)}</div>
                        <div style="color: rgba(255,255,255,0.6); font-size: 11px; margin-top: 4px;">
                            ${task.originalProject} • ${task.originalSection === 'today' ? '⚡ Today' : '📅 Long-term'}
                            ${task.dueDate ? ` • Due: ${task.dueDate}` : ''}
                        </div>
                    </div>
                    <button onclick="unarchiveTask(${archivedTasks.indexOf(task)})"
                            style="padding: 6px 12px; background: rgba(102, 126, 234, 0.2); color: #667eea; border: 1px solid #667eea; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        Restore
                    </button>
                </div>
            `;
        });

        html += '</div>';
    });

    container.innerHTML = html;
}

window.unarchiveTask = function(index) {
    const task = archivedTasks[index];

    // Find or create the original project
    let group = taskData[task.originalSection].find(g => g.groupName === task.originalProject);
    if (!group) {
        group = { groupName: task.originalProject, tasks: [] };
        taskData[task.originalSection].push(group);
    }

    // Remove archive metadata and add back to project
    const restoredTask = {
        title: task.title,
        completed: false, // Restore as incomplete
        ...(task.dueDate && { dueDate: task.dueDate }),
        ...(task.subtasks && { subtasks: task.subtasks })
    };

    group.tasks.push(restoredTask);

    // Remove from archive
    archivedTasks.splice(index, 1);

    saveData();
    renderTasks();
    renderArchive();
    updateStats();
    updateProgress();
}

window.clearArchive = function() {
    if (confirm(`Are you sure you want to permanently delete all ${archivedTasks.length} archived tasks?\n\nThis action cannot be undone.`)) {
        archivedTasks = [];
        localStorage.setItem('archivedTasks', JSON.stringify(archivedTasks));
        renderArchive();
        alert('Archive cleared.');
    }
}

// Close panels when clicking overlay
document.getElementById('overlay').addEventListener('click', function() {
    document.getElementById('statsPanel').classList.remove('open');
    document.getElementById('settingsPanel').classList.remove('open');
    this.classList.remove('active');
});

// Check for lost data in localStorage
window.checkForLostData = function() {
    console.log('=== Checking for lost data ===');
    console.log('Current taskData:', taskData);
    
    // Check raw localStorage
    const rawData = localStorage.getItem('taskData');
    console.log('Raw localStorage data:', rawData);
    
    // Check backups
    const backups = JSON.parse(localStorage.getItem('taskData_backups') || '[]');
    console.log('Available backups:', backups);
    
    // Check archived tasks
    console.log('Archived tasks:', archivedTasks);
    
    alert('Check the browser console (F12) for detailed information about your data.');
    return { taskData, backups, archivedTasks };
}

// Restore from backup
window.restoreFromBackup = function() {
    const backups = JSON.parse(localStorage.getItem('taskData_backups') || '[]');
    
    if (backups.length === 0) {
        alert('No backups found. Backups will be created automatically starting now.');
        return;
    }
    
    // Show list of backups
    let backupList = 'Available backups:\n\n';
    backups.forEach((backup, index) => {
        const date = new Date(backup.timestamp);
        backupList += `${index + 1}. ${date.toLocaleString()}\n`;
    });
    
    const choice = prompt(backupList + '\nEnter the backup number to restore (1-' + backups.length + '), or cancel to abort:');
    const backupIndex = parseInt(choice) - 1;
    
    if (backupIndex >= 0 && backupIndex < backups.length) {
        const backup = backups[backupIndex];
        if (backup && backup.taskData) {
            if (confirm(`Restore backup from ${new Date(backup.timestamp).toLocaleString()}? This will replace your current tasks.`)) {
                taskData = backup.taskData;
                saveData();
                renderTasks();
                updateStats();
                updateProgress();
                alert('✓ Backup restored!');
            }
        } else {
            alert('Invalid backup data.');
        }
    }
}

// Focus mode functions
function initFocusMode() {
    if (settings.activeTask && settings.activeTask.alertInterval) {
        startFocusTimer();
    }
}

function startFocusTimer() {
    clearFocusTimer(); // Clear any existing timer
    
    if (!settings.activeTask || !settings.activeTask.alertInterval) {
        return;
    }
    
    // Verify the active task still exists
    const { section, groupIndex, taskIndex } = settings.activeTask;
    if (!taskData[section] || !taskData[section][groupIndex] || !taskData[section][groupIndex].tasks[taskIndex]) {
        // Task no longer exists, clear focus
        settings.activeTask = null;
        saveData();
        return;
    }
    
    const intervalMs = settings.activeTask.alertInterval * 60 * 1000; // Convert minutes to milliseconds
    
    focusTimer = setInterval(() => {
        showFocusAlert();
    }, intervalMs);
}

function clearFocusTimer() {
    if (focusTimer) {
        clearInterval(focusTimer);
        focusTimer = null;
    }
}

function showFocusAlert() {
    if (!settings.activeTask) {
        clearFocusTimer();
        return;
    }
    
    const { section, groupIndex, taskIndex, websiteUrl } = settings.activeTask;
    
    // Verify task still exists
    if (!taskData[section] || !taskData[section][groupIndex] || !taskData[section][groupIndex].tasks[taskIndex]) {
        settings.activeTask = null;
        saveData();
        clearFocusTimer();
        return;
    }
    
    const task = taskData[section][groupIndex].tasks[taskIndex];
    const taskTitle = task.title;
    
    // Show browser notification (works even when tab is in background)
    if ('Notification' in window && Notification.permission === 'granted') {
        const notificationOptions = {
            body: websiteUrl 
                ? `Click to open the linked website or view the task.\n\n🌐 ${websiteUrl}`
                : 'Click to view the task and respond.',
            icon: '🎯',
            badge: '🎯',
            tag: 'focus-alert', // Replace previous notifications
            requireInteraction: true, // Keep notification visible until user interacts
            data: {
                section,
                groupIndex,
                taskIndex,
                websiteUrl
            }
        };
        
        const notification = new Notification(`🎯 Still working on: "${taskTitle}"?`, notificationOptions);
        
        // Handle notification click
        notification.onclick = (event) => {
            event.preventDefault();
            window.focus(); // Bring window to front
            
            // Show the alert dialog when user clicks notification
            showFocusAlertDialog(section, groupIndex, taskIndex, taskTitle, websiteUrl);
            
            notification.close();
        };
        
        // Auto-close notification after 30 seconds if not interacted with
        setTimeout(() => notification.close(), 30000);
    }
    
    // Also show dialog if tab is active (for immediate response)
    if (document.visibilityState === 'visible') {
        showFocusAlertDialog(section, groupIndex, taskIndex, taskTitle, websiteUrl);
    }
}

function showFocusAlertDialog(section, groupIndex, taskIndex, taskTitle, websiteUrl) {
    // Check if dialog already exists to prevent duplicates
    const existingDialog = document.getElementById('focusAlertDialog');
    if (existingDialog) {
        return; // Dialog already showing
    }
    
    // Create a custom alert with website link button
    const alertDiv = document.createElement('div');
    alertDiv.id = 'focusAlertDialog';
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, rgba(79, 172, 254, 0.95) 0%, rgba(0, 242, 254, 0.95) 100%);
        backdrop-filter: blur(20px);
        padding: 30px;
        border-radius: 20px;
        box-shadow: 0 15px 45px rgba(0,0,0,0.5);
        z-index: 10000;
        max-width: 500px;
        text-align: center;
        border: 2px solid rgba(255, 255, 255, 0.5);
    `;
    
    alertDiv.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 15px;">🎯</div>
        <div style="font-size: 18px; font-weight: 700; color: white; margin-bottom: 15px; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
            Are you still working on:
        </div>
        <div style="font-size: 20px; font-weight: 600; color: white; margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.2); border-radius: 10px; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
            "${taskTitle}"
        </div>
        ${websiteUrl ? `
            <a href="${websiteUrl}" target="_blank" 
               style="display: inline-block; padding: 12px 24px; background: rgba(255, 255, 255, 0.9); color: #333; text-decoration: none; border-radius: 10px; font-weight: 600; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s;">
                🌐 Open Linked Website
            </a>
            <div style="margin-bottom: 15px;"></div>
        ` : ''}
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="focusAlertContinue" 
                    style="padding: 12px 30px; background: rgba(67, 233, 123, 0.9); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                ✅ Yes, Still Working
            </button>
            <button id="focusAlertStop" 
                    style="padding: 12px 30px; background: rgba(255, 107, 107, 0.9); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                ❌ Stop Focusing
            </button>
        </div>
    `;
    
    const removeDialog = () => {
        if (alertDiv && alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    };
    
    document.body.appendChild(alertDiv);
    
    // Handle button clicks
    document.getElementById('focusAlertContinue').onclick = () => {
        removeDialog();
        // Timer continues automatically
    };
    
    document.getElementById('focusAlertStop').onclick = () => {
        removeDialog();
        // Stop focusing
        toggleFocusTask(section, groupIndex, taskIndex);
    };
    
    // Focus on continue button for keyboard accessibility
    setTimeout(() => document.getElementById('focusAlertContinue').focus(), 100);
    
    // Close dialog when clicking outside (optional)
    alertDiv.onclick = (e) => {
        if (e.target === alertDiv) {
            removeDialog();
        }
    };
}

window.toggleFocusTask = async function(section, groupIndex, taskIndex) {
    // Check if this is already the active task
    const isCurrentlyActive = settings.activeTask &&
        settings.activeTask.section === section &&
        settings.activeTask.groupIndex === groupIndex &&
        settings.activeTask.taskIndex === taskIndex;
    
    if (isCurrentlyActive) {
        // Stop focusing
        settings.activeTask = null;
        clearFocusTimer();
        saveData();
        renderTasks();
        alert('🎯 Focus mode stopped for this task.');
    } else {
        // Start focusing on this task - show setup dialog
        const task = taskData[section][groupIndex].tasks[taskIndex];
        
        // Ask for alert interval
        const intervalInput = await showCustomModal(
            '🎯 Focus Mode Setup',
            `Task: "${task.title}"\n\nHow often should we check in?\n\nEnter: 5, 10, or 15 (minutes)`,
            '10'
        );
        
        if (intervalInput === null) return; // User cancelled
        
        let alertInterval = parseInt(intervalInput);
        if (isNaN(alertInterval) || ![5, 10, 15].includes(alertInterval)) {
            alertInterval = 10; // Default to 10 minutes
        }
        
        // Ask for website URL (optional)
        const websiteInput = await showCustomModal(
            '🌐 Link Website (Optional)',
            `Do you want to link a specific website for this task?\n\nEnter the URL (e.g., https://example.com)\nOr leave blank to skip.`,
            ''
        );
        
        let websiteUrl = null;
        if (websiteInput !== null && websiteInput.trim() !== '') {
            // Validate and format URL
            let url = websiteInput.trim();
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            try {
                new URL(url); // Validate URL
                websiteUrl = url;
            } catch (e) {
                alert('Invalid URL format. Focus mode will continue without website link.');
            }
        }
        
        // Start focusing
        settings.activeTask = {
            section,
            groupIndex,
            taskIndex,
            alertInterval,
            websiteUrl
        };
        
        startFocusTimer();
        saveData();
        renderTasks();
        
        // Show confirmation
        let confirmMsg = `🎯 Now focusing on: "${task.title}"\n\nYou'll receive alerts every ${alertInterval} minutes.`;
        if (websiteUrl) {
            confirmMsg += `\n\n🌐 Website linked: ${websiteUrl}`;
        }
        alert(confirmMsg);
    }
}

window.updateFocusAlertInterval = function() {
    const select = document.getElementById('focusAlertInterval');
    const newInterval = parseInt(select.value);
    
    if (newInterval === 5 || newInterval === 10 || newInterval === 15) {
        settings.focusAlertInterval = newInterval; // Store as default for future focus sessions
        saveData();
        
        // Update current active task if exists
        if (settings.activeTask) {
            settings.activeTask.alertInterval = newInterval;
            startFocusTimer(); // Restart with new interval
            saveData();
        }
        
        alert(`✓ Default focus alert interval updated to ${newInterval} minutes.\n\nNote: You can set a custom interval when focusing on each task.`);
    }
}

// Test function to trigger focus alert immediately (for testing)
window.testFocusAlert = function() {
    if (!settings.activeTask) {
        alert('⚠️ No task is currently focused.\n\nPlease click the 🎯 button on a task first to enable focus mode.');
        return;
    }
    
    const { section, groupIndex, taskIndex } = settings.activeTask;
    
    // Verify task still exists
    if (!taskData[section] || !taskData[section][groupIndex] || !taskData[section][groupIndex].tasks[taskIndex]) {
        alert('⚠️ The focused task no longer exists.');
        settings.activeTask = null;
        saveData();
        return;
    }
    
    // Show the alert immediately for testing
    showFocusAlert();
}

// Test function to check focus mode status
window.checkFocusStatus = function() {
    if (!settings.activeTask) {
        console.log('📊 Focus Status: No task is currently focused.');
        alert('📊 Focus Status: No task is currently focused.');
        return;
    }
    
    const { section, groupIndex, taskIndex, alertInterval, websiteUrl } = settings.activeTask;
    
    // Verify task still exists
    if (!taskData[section] || !taskData[section][groupIndex] || !taskData[section][groupIndex].tasks[taskIndex]) {
        console.log('⚠️ Focus Status: The focused task no longer exists.');
        alert('⚠️ Focus Status: The focused task no longer exists.');
        return;
    }
    
    const task = taskData[section][groupIndex].tasks[taskIndex];
    
    let statusMsg = `📊 Focus Mode Status:\n\n`;
    statusMsg += `Task: "${task.title}"\n`;
    statusMsg += `Alert Interval: ${alertInterval} minutes\n`;
    statusMsg += `Website: ${websiteUrl || 'None'}\n`;
    statusMsg += `Timer Active: ${focusTimer ? 'Yes ✅' : 'No ❌'}\n\n`;
    statusMsg += `To test the alert, open the console (F12) and type: testFocusAlert()`;
    
    console.log('Focus Status:', {
        task: task.title,
        interval: alertInterval + ' minutes',
        website: websiteUrl || 'None',
        timerActive: focusTimer !== null
    });
    
    alert(statusMsg);
}

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

// Save data to localStorage with backup
function saveData() {
    try {
        // Create a backup of current data before saving
        const currentData = {
            taskData: JSON.parse(localStorage.getItem('taskData') || 'null'),
            timestamp: Date.now()
        };
        
        // Keep only the last 5 backups (to avoid filling localStorage)
        let backups = JSON.parse(localStorage.getItem('taskData_backups') || '[]');
        backups.push(currentData);
        if (backups.length > 5) {
            backups = backups.slice(-5); // Keep only last 5
        }
        localStorage.setItem('taskData_backups', JSON.stringify(backups));
        
        // Save current data
        localStorage.setItem('taskData', JSON.stringify(taskData));
        localStorage.setItem('archivedTasks', JSON.stringify(archivedTasks));
        localStorage.setItem('settings', JSON.stringify(settings));
        localStorage.setItem('taskData_lastSaved', Date.now().toString());
    } catch (error) {
        console.error('Error saving data:', error);
        alert('Warning: Failed to save task data. Please check your browser storage.');
    }
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
    const focusIntervalSelect = document.getElementById('focusAlertInterval');
    
    // Load focus alert interval setting
    if (focusIntervalSelect) {
        focusIntervalSelect.value = settings.focusAlertInterval || 10;
    }

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

CRITICAL: Return ONLY a valid JSON array, nothing else. No markdown, no explanations, no text before or after.

Return a JSON array of objects with this structure:
[{
  "step": "Action step description",
  "energy": "low|medium|high",
  "timeEstimate": "5-10 min",
  "adhdTip": "Helpful ADHD-specific tip"
}]

Example response (return exactly in this format):
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

CRITICAL: Return ONLY a valid JSON array, nothing else. No markdown, no explanations, no text before or after.

For each task, include:
- Task type (communication, research, decision, cleanup, action)
- Energy level (low/medium/high)
- Time estimate
- Emotional weight (light/moderate/heavy)
- Dependencies

Return JSON in exactly this format:
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

    const systemPrompt = `You are a task management assistant. Break down tasks into 3-5 clear, actionable subtasks.

CRITICAL: Return ONLY a valid JSON array of strings, nothing else. No markdown, no explanations, no text before or after.

Example response (return exactly in this format):
["Subtask 1", "Subtask 2", "Subtask 3"]`;

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

    const systemPrompt = `You are a project management assistant. Break down projects into 5-8 clear, actionable tasks.

CRITICAL: Return ONLY a valid JSON array of strings, nothing else. No markdown, no explanations, no text before or after.

Example response (return exactly in this format):
["Task 1", "Task 2", "Task 3"]`;

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
