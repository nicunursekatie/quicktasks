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
let notes = JSON.parse(localStorage.getItem('notes')) || [];
let settings = JSON.parse(localStorage.getItem('settings')) || {
    darkMode: false,
    showCompleted: true,
    openaiApiKey: '',
    geminiApiKey: '',
    groqApiKey: '',
    anthropicApiKey: '',
    aiProvider: 'gemini',
    focusAlertInterval: 10, // minutes: 5, 10, or 15
    activeTask: null, // { section, groupIndex, taskIndex, websiteUrl, alertInterval }
    savedUrls: [] // Array of previously used URLs for autocomplete
};

let currentUser = null;
let unsubscribe = null;

// Focus mode timer
let focusTimer = null;
let focusAlertInterval = null;
let focusStartTime = null; // Track when focus mode started
let lastAlertTime = null; // Track when last alert was shown

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

// Choice Modal System (for selecting between multiple options)
let choiceResolve = null;

function showChoiceModal(title, message, options) {
    // options is an array of { value, label, icon, description }
    return new Promise((resolve) => {
        choiceResolve = resolve;
        document.getElementById('choiceModalTitle').textContent = title;
        document.getElementById('choiceModalMessage').textContent = message;

        const buttonsContainer = document.getElementById('choiceModalButtons');
        buttonsContainer.innerHTML = '';

        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.innerHTML = `
                <span class="choice-icon">${option.icon || ''}</span>
                <div class="choice-label">
                    ${option.label}
                    ${option.description ? `<div class="choice-description">${option.description}</div>` : ''}
                </div>
            `;
            btn.onclick = () => selectChoice(option.value);
            buttonsContainer.appendChild(btn);
        });

        document.getElementById('choiceModal').classList.add('active');

        // Handle escape key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeChoiceModal();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    });
}

function selectChoice(value) {
    document.getElementById('choiceModal').classList.remove('active');
    if (choiceResolve) {
        choiceResolve(value);
        choiceResolve = null;
    }
}

function closeChoiceModal() {
    document.getElementById('choiceModal').classList.remove('active');
    if (choiceResolve) {
        choiceResolve(null);
        choiceResolve = null;
    }
}

window.showChoiceModal = showChoiceModal;
window.selectChoice = selectChoice;
window.closeChoiceModal = closeChoiceModal;

// Confirm Modal System (for yes/no questions)
let confirmResolve = null;

function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        confirmResolve = resolve;
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        document.getElementById('confirmModal').classList.add('active');

        // Handle escape key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeConfirmModal(false);
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
    });
}

function closeConfirmModal(result) {
    document.getElementById('confirmModal').classList.remove('active');
    if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
    }
}

window.showConfirmModal = showConfirmModal;
window.closeConfirmModal = closeConfirmModal;

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

// Helper function to get today's date as YYYY-MM-DD
function getTodayDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return formatDate(today);
}

// Extract date from task title text (e.g., "finish report by friday")
function extractDateFromTitle(title) {
    if (!title) return { cleanTitle: title, dueDate: null };

    const text = title.toLowerCase();

    // Pattern: "by [date]" or "due [date]"
    const byMatch = text.match(/\b(by|due|before)\s+(today|tomorrow|tmr|tom|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in\s+\d+\s+days?)\b/i);

    if (byMatch) {
        const datePhrase = byMatch[2].trim();
        const parsedDate = parseNaturalDate(datePhrase);

        if (parsedDate) {
            // Remove the date phrase from the title
            const cleanTitle = title.replace(new RegExp(`\\s*\\b${byMatch[1]}\\s+${byMatch[2]}\\b`, 'i'), '').trim();
            return { cleanTitle, dueDate: parsedDate };
        }
    }

    return { cleanTitle: title, dueDate: null };
}

// Initialize
function init() {
    updateDateStamp();
    applyTheme();
    // Migrate existing tasks to zones (one-time migration on first load after update)
    migrateTasksToZones();
    renderTasks();
    renderNotes();
    updateStats();
    updateProgress();
    loadOpenAIKey();
    initFocusMode();
    requestNotificationPermission();
    initFirestoreSync();
}

// Initialize Firestore sync
function initFirestoreSync() {
    // Wait for Firebase to be ready
    if (window.firebaseReady) {
        // Firebase already ready, sync now
        syncToFirestore();
    } else {
        // Wait for Firebase ready event
        window.addEventListener('firebaseReady', () => {
            syncToFirestore();
        });
    }
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

// Helper function to get date X days from today
function getDateDaysFromToday(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return formatDate(date);
}

// Check if a date string is within N days from today
function isDateWithinDays(dateStr, days) {
    if (!dateStr) return false;
    const taskDate = new Date(dateStr);
    taskDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.ceil((taskDate - today) / (1000 * 60 * 60 * 24));
    return daysDiff >= 0 && daysDiff <= days;
}

// Get all tasks with their metadata (section, groupIndex, taskIndex, groupName)
function getAllTasksWithMetadata() {
    const allTasks = [];
    ['today', 'longterm'].forEach(section => {
        taskData[section].forEach((group, groupIndex) => {
            group.tasks.forEach((task, taskIndex) => {
                allTasks.push({
                    ...task,
                    section,
                    groupIndex,
                    taskIndex,
                    groupName: group.groupName
                });
            });
        });
    });
    return allTasks;
}

// Get tasks for Critical zone
function getTasksForCriticalZone() {
    const allTasks = getAllTasksWithMetadata();
    const today = getTodayDate();
    const tomorrow = getDateDaysFromToday(1);
    
    return allTasks.filter(task => {
        if (task.completed && !settings.showCompleted) return false;
        
        // Check if explicitly in critical zone
        if (task.zone === 'critical') return true;
        
        // Check if blocking others
        if (task.isBlocking === true) return true;
        
        // Check if has external deadline within 3 days
        if (task.externalDeadline && isDateWithinDays(task.externalDeadline, 3)) {
            return true;
        }
        
        // Check if due date is today/tomorrow AND has blocking indicator
        if (task.dueDate && (task.dueDate === today || task.dueDate === tomorrow) && task.isBlocking === true) {
            return true;
        }
        
        return false;
    });
}

// Get tasks for Focus zone
function getTasksForFocusZone() {
    const allTasks = getAllTasksWithMetadata();
    
    return allTasks.filter(task => {
        if (task.completed && !settings.showCompleted) return false;
        return task.isInFocus === true;
    }).slice(0, 7); // Limit to 7 most important
}

// Get tasks for Inbox zone
function getTasksForInboxZone() {
    const allTasks = getAllTasksWithMetadata();
    const today = getTodayDate();
    const tomorrow = getDateDaysFromToday(1);
    
    return allTasks.filter(task => {
        if (task.completed && !settings.showCompleted) return false;
        
        // Explicitly in inbox zone
        if (task.zone === 'inbox') return true;
        
        // Tasks without explicit zone assignment (backwards compatibility)
        // Only include if they don't match other zone criteria
        if (!task.zone && !task.isInFocus) {
            // Check if it would be in critical zone
            const isBlocking = task.isBlocking === true;
            const hasExternalDeadline = task.externalDeadline && isDateWithinDays(task.externalDeadline, 3);
            const hasUrgentDueDate = task.dueDate && (task.dueDate === today || task.dueDate === tomorrow) && task.isBlocking;
            
            // Only show in inbox if not critical
            if (isBlocking || hasExternalDeadline || hasUrgentDueDate) {
                return false;
            }
            
            return true;
        }
        
        return false;
    });
}

// Auto-update task zone property based on other properties
function updateTaskZoneProperties(task) {
    // Don't override explicit zone assignment
    if (task.zone === 'inbox' || task.zone === 'critical' || task.zone === 'focus') {
        // Zone already set explicitly, but we can still validate
        return;
    }
    
    // Auto-assign zone based on properties
    const today = getTodayDate();
    const tomorrow = getDateDaysFromToday(1);
    
    if (task.isBlocking || 
        (task.externalDeadline && isDateWithinDays(task.externalDeadline, 3)) ||
        (task.dueDate && (task.dueDate === today || task.dueDate === tomorrow) && task.isBlocking)) {
        task.zone = 'critical';
    } else if (task.isInFocus) {
        task.zone = 'focus';
    } else {
        task.zone = 'inbox';
    }
}

// Migrate existing tasks to have zone properties (one-time migration)
function migrateTasksToZones() {
    // Check if migration has already been done
    if (localStorage.getItem('zonesMigrated') === 'true') {
        return; // Already migrated
    }
    
    let migrated = false;
    
    ['today', 'longterm'].forEach(section => {
        taskData[section].forEach((group) => {
            group.tasks.forEach((task) => {
                // Only migrate tasks that don't already have a zone
                if (!task.zone) {
                    migrated = true;
                    updateTaskZoneProperties(task);
                }
            });
        });
    });
    
    if (migrated) {
        saveData();
        localStorage.setItem('zonesMigrated', 'true');
        console.log('Migrated existing tasks to zone-based organization');
    }
}

// Render tasks for a specific zone
function renderZone(zoneType, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let tasks = [];
    if (zoneType === 'critical') {
        tasks = getTasksForCriticalZone();
    } else if (zoneType === 'focus') {
        tasks = getTasksForFocusZone();
    } else if (zoneType === 'inbox') {
        tasks = getTasksForInboxZone();
    }
    
    if (tasks.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-style: italic;">No tasks in this zone</div>`;
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        return renderTask(task.section, task.groupIndex, task.taskIndex, task, zoneType);
    }).join('');
}

// Render all tasks
function renderTasks() {
    // Render zones
    renderZone('critical', 'criticalTasks');
    renderZone('focus', 'focusTasks');
    renderZone('inbox', 'inboxTasks');
    
    // Also render sections for backwards compatibility (can be hidden with CSS later)
    renderSection('today', 'todayTasks');
    renderSection('longterm', 'longtermTasks');
    
    // Update focus banner
    updateFocusBanner();
    
    // Attach drag-and-drop event listeners after rendering
    attachDragAndDropListeners();
}

// Update focus mode banner
function updateFocusBanner() {
    const banner = document.getElementById('focusBanner');
    const bannerTask = document.getElementById('focusBannerTask');
    const mainContainer = document.getElementById('mainContainer');
    
    if (!banner || !bannerTask) return;
    
    if (settings.activeTask) {
        const { section, groupIndex, taskIndex } = settings.activeTask;
        
        // Verify task still exists
        if (taskData[section] && taskData[section][groupIndex] && taskData[section][groupIndex].tasks[taskIndex]) {
            const task = taskData[section][groupIndex].tasks[taskIndex];
            bannerTask.textContent = task.title.toUpperCase();
            banner.classList.remove('hidden');
            if (mainContainer) {
                mainContainer.classList.add('with-focus-banner');
            }
            return;
        } else {
            // Task no longer exists, clear focus
            settings.activeTask = null;
            saveData();
        }
    }
    
    // No active task - hide banner
    banner.classList.add('hidden');
    if (mainContainer) {
        mainContainer.classList.remove('with-focus-banner');
    }
}

window.stopFocusFromBanner = function() {
    if (settings.activeTask) {
        const { section, groupIndex, taskIndex } = settings.activeTask;
        toggleFocusTask(section, groupIndex, taskIndex);
    }
}

// Render a section
function renderSection(section, containerId) {
    const container = document.getElementById(containerId);
    let groups = taskData[section];

    if (!groups || groups.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <div>No tasks yet. Add one to get started!</div>
            </div>
        `;
        return;
    }
    
    // Create a map to track original task indices for focused groups
    const taskIndexMap = new Map();

    container.innerHTML = groups.map((group, groupIndex) => {
        // Check if this group has the focused task
        const hasFocusedTask = settings.activeTask && 
                               settings.activeTask.section === section &&
                               settings.activeTask.groupIndex === groupIndex;
        
        let tasksToRender = group.tasks;
        
        // If this group has the focused task, reorder tasks to put it first
        if (hasFocusedTask && settings.activeTask.taskIndex >= 0 && settings.activeTask.taskIndex < group.tasks.length) {
            tasksToRender = [...group.tasks];
            const focusedTask = tasksToRender[settings.activeTask.taskIndex];
            tasksToRender.splice(settings.activeTask.taskIndex, 1);
            tasksToRender.unshift(focusedTask);
            
            // Create mapping: display index -> actual index
            tasksToRender.forEach((task, displayIndex) => {
                if (displayIndex === 0) {
                    taskIndexMap.set(`${groupIndex}-${displayIndex}`, settings.activeTask.taskIndex);
                } else if (displayIndex <= settings.activeTask.taskIndex) {
                    taskIndexMap.set(`${groupIndex}-${displayIndex}`, displayIndex);
                } else {
                    taskIndexMap.set(`${groupIndex}-${displayIndex}`, displayIndex);
                }
            });
        }
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
                        <button class="group-archive-btn" onclick="archiveGroup('${section}', ${groupIndex})" title="Archive project">📦</button>
                        <button class="group-delete-btn" onclick="deleteGroup('${section}', ${groupIndex})" title="Delete project">🗑️</button>
                    </div>
                </div>
                <div class="group-progress">
                    <div class="group-progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="task-list" data-section="${section}" data-group-index="${groupIndex}">
                    ${tasksToRender.map((task, displayIndex) => {
                        // Map display index to actual index for data attributes
                        let actualIndex = displayIndex;
                        if (hasFocusedTask) {
                            if (displayIndex === 0) {
                                actualIndex = settings.activeTask.taskIndex;
                            } else if (displayIndex <= settings.activeTask.taskIndex) {
                                actualIndex = displayIndex - 1;
                            } else {
                                actualIndex = displayIndex;
                            }
                        }
                        return renderTask(section, groupIndex, actualIndex, task);
                    }).join('')}
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
    
    // Attach listeners to zone containers (drop zones for tasks)
    const criticalTasks = document.getElementById('criticalTasks');
    const focusTasks = document.getElementById('focusTasks');
    const inboxTasks = document.getElementById('inboxTasks');
    
    [criticalTasks, focusTasks, inboxTasks].forEach(container => {
        if (container && !container.hasAttribute('data-drag-listeners')) {
            container.setAttribute('data-drag-listeners', 'true');
            container.addEventListener('dragover', handleDragOver);
            container.addEventListener('drop', handleZoneDrop);
            container.addEventListener('dragleave', handleDragLeave);
        }
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

function handleZoneDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedType !== 'task' || !draggedElement) return false;
    
    const dropTarget = this;
    const draggedSection = draggedElement.dataset.section;
    const draggedGroupIndex = parseInt(draggedElement.dataset.groupIndex);
    const draggedTaskIndex = parseInt(draggedElement.dataset.taskIndex);
    
    // Determine target zone from container ID
    let targetZone = null;
    if (dropTarget.id === 'criticalTasks') {
        targetZone = 'critical';
    } else if (dropTarget.id === 'focusTasks') {
        // For focus zone, toggle the focus flag instead of setting zone
        const task = taskData[draggedSection][draggedGroupIndex].tasks[draggedTaskIndex];
        if (task) {
            task.isInFocus = true;
            saveData();
            renderTasks();
            updateStats();
            updateProgress();
        }
        dropTarget.classList.remove('drag-over-list');
        return false;
    } else if (dropTarget.id === 'inboxTasks') {
        targetZone = 'inbox';
    } else {
        return false;
    }
    
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
    
    const task = taskData[draggedSection][draggedGroupIndex].tasks[draggedTaskIndex];
    if (!task) {
        console.error('Could not find dragged task:', { draggedSection, draggedGroupIndex, draggedTaskIndex });
        return false;
    }
    
    try {
        // Update zone property
        task.zone = targetZone;
        
        // Auto-update zone properties if moving to critical
        if (targetZone === 'critical' && !task.isBlocking) {
            task.isBlocking = true;
        }
        
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    } catch (error) {
        console.error('Error during zone drop:', error);
        renderTasks();
        alert('An error occurred while moving the task to zone. Please try again.');
        return false;
    }
    
    dropTarget.classList.remove('drag-over-list');
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
function renderTask(section, groupIndex, taskIndex, task, zoneType = null) {
    if (!settings.showCompleted && task.completed) return '';

    // Determine zone class for styling
    let zoneClass = '';
    if (zoneType) {
        zoneClass = `zone-${zoneType}`;
    } else if (task.zone) {
        zoneClass = `zone-${task.zone}`;
    }

    // Build zone indicators
    let zoneIndicators = '';
    if (task.isBlocking) {
        zoneIndicators += '<span class="task-blocking-icon" title="Blocking others / Someone is relying on me">👤</span>';
    }
    if (task.externalDeadline) {
        zoneIndicators += `<span class="task-external-deadline" title="External deadline: ${task.externalDeadline}">${task.externalDeadline}</span>`;
    }
    if (task.isInFocus) {
        zoneIndicators += '<span class="task-focus-indicator" title="In Today\'s Focus">🎯</span>';
    }

    return `
        <div class="task-item ${task.completed ? 'checked' : ''} ${zoneClass} ${settings.activeTask && settings.activeTask.section === section && settings.activeTask.groupIndex === groupIndex && settings.activeTask.taskIndex === taskIndex ? 'focused-task' : ''}" 
             draggable="true" 
             data-section="${section}" 
             data-group-index="${groupIndex}" 
             data-task-index="${taskIndex}"
             data-zone="${zoneType || task.zone || ''}">
            <span class="drag-handle-task" title="Drag to reorder" style="user-select: none;">⋮⋮</span>
            <input type="checkbox"
                   class="task-checkbox"
                   ${task.completed ? 'checked' : ''}
                   onclick="toggleTask('${section}', ${groupIndex}, ${taskIndex})"
                   title="Mark as ${task.completed ? 'incomplete' : 'complete'}">
            <div class="task-content" onclick="if(!window.isDragging) editTask('${section}', ${groupIndex}, ${taskIndex})" style="cursor: pointer;">
                <div class="task-title">
                    ${task.emotionalWeight === 'light' ? '💨 ' : task.emotionalWeight === 'moderate' ? '⚖️ ' : task.emotionalWeight === 'heavy' ? '🎯 ' : ''}${escapeHtml(task.title)}
                    ${zoneIndicators}
                    ${task.status && task.status !== 'not-started' ? `<span style="display: inline-block; margin-left: 8px; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; ${
                        task.status === 'planning' ? 'background: rgba(255, 193, 7, 0.2); color: #f39c12; border: 1px solid rgba(243, 156, 18, 0.4);' :
                        task.status === 'in-progress' ? 'background: rgba(52, 152, 219, 0.2); color: #3498db; border: 1px solid rgba(52, 152, 219, 0.4);' :
                        task.status === 'completed' ? 'background: rgba(46, 204, 113, 0.2); color: #27ae60; border: 1px solid rgba(39, 174, 96, 0.4);' :
                        'background: rgba(149, 165, 166, 0.2); color: #7f8c8d; border: 1px solid rgba(127, 140, 141, 0.4);'
                    }">${
                        task.status === 'planning' ? '💭 Planning' :
                        task.status === 'in-progress' ? '🔵 In Progress' :
                        task.status === 'completed' ? '✅ Completed' :
                        '⚪ Not Started'
                    }</span>` : ''}
                    ${task.notes ? `<span style="display: inline-block; margin-left: 6px; font-size: 14px;" title="Has notes/plan">📝</span>` : ''}
                    ${task.completed && task.actualMinutes && task.estimatedMinutes
                        ? `<span style="font-size: 12px; color: rgba(255,255,255,0.7); margin-left: 8px;">⏱️ ${task.actualMinutes}/${task.estimatedMinutes}min</span>`
                        : task.estimatedMinutes
                        ? `<span style="font-size: 12px; color: rgba(255,255,255,0.7); margin-left: 8px;">⏱️ ${task.estimatedMinutes}min</span>`
                        : ''
                    }
                    ${task.dueDate && !task.externalDeadline ? `<span style="font-size: 12px; color: rgba(255,255,255,0.7); margin-left: 8px;">📅 ${task.dueDate}</span>` : ''}
                </div>
                ${task.tags && task.tags.length > 0 ? `
                    <div class="task-tags">
                        ${task.tags.map(tag => `<span class="task-tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
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
                <button class="status-toggle-btn"
                        onclick="event.stopPropagation(); toggleTaskStatus('${section}', ${groupIndex}, ${taskIndex})"
                        title="Change status: ${task.status === 'planning' ? 'Planning' : task.status === 'in-progress' ? 'In Progress' : task.status === 'completed' ? 'Completed' : 'Not Started'}">${
                    task.status === 'planning' ? '💭' :
                    task.status === 'in-progress' ? '🔵' :
                    task.status === 'completed' ? '✅' :
                    '⚪'
                }</button>
                <button class="focus-btn ${task.isInFocus ? 'active' : ''} ${settings.activeTask && settings.activeTask.section === section && settings.activeTask.groupIndex === groupIndex && settings.activeTask.taskIndex === taskIndex ? 'active' : ''}"
                        onclick="event.stopPropagation(); toggleFocus('${section}', ${groupIndex}, ${taskIndex})"
                        title="${task.isInFocus ? 'Remove from Today\'s Focus' : 'Add to Today\'s Focus'}">🎯</button>
                <button class="zone-btn" onclick="event.stopPropagation(); moveTaskToZone('${section}', ${groupIndex}, ${taskIndex}, 'critical')" title="Move to Critical zone">🚨</button>
                <button class="zone-btn" onclick="event.stopPropagation(); moveTaskToZone('${section}', ${groupIndex}, ${taskIndex}, 'inbox')" title="Move to Inbox">📥</button>
                <button class="ai-btn" onclick="showAIMenu('${section}', ${groupIndex}, ${taskIndex})" title="AI Assistant">✨</button>
                <button class="edit-btn" onclick="editTask('${section}', ${groupIndex}, ${taskIndex})" title="Edit task">✏️</button>
                <button class="convert-btn" onclick="convertToProject('${section}', ${groupIndex}, ${taskIndex})" title="Convert to project">📁</button>
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
    document.getElementById('newTaskStatus').value = 'not-started';
    document.getElementById('newTaskTags').value = '';
    document.getElementById('newTaskNotes').value = '';

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
    let title = document.getElementById('newTaskTitle').value.trim();
    if (!title) {
        alert('Please enter a task title');
        return;
    }

    const section = document.querySelector('input[name="newTaskSection"]:checked').value;
    const projectValue = document.getElementById('newTaskProject').value;
    const dueDateInput = document.getElementById('newTaskDueDate').value;
    const estimate = document.getElementById('newTaskEstimate').value;

    // Extract date from title if present
    const { cleanTitle, dueDate: extractedDate } = extractDateFromTitle(title);

    const newTask = {
        title: cleanTitle,
        completed: false
    };

    // Parse natural language date (prioritize explicit due date field over extracted date)
    if (dueDateInput) {
        const parsedDate = parseNaturalDate(dueDateInput);
        if (parsedDate) {
            newTask.dueDate = parsedDate;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateInput)) {
            newTask.dueDate = dueDateInput;
        }
    } else if (extractedDate) {
        // Use extracted date from title if no explicit due date
        newTask.dueDate = extractedDate;
    }

    if (estimate && parseInt(estimate) > 0) {
        newTask.estimatedMinutes = parseInt(estimate);
    }

    const emotionalWeight = document.getElementById('newTaskEmotionalWeight').value;
    if (emotionalWeight) {
        newTask.emotionalWeight = emotionalWeight;
    }

    const status = document.getElementById('newTaskStatus').value;
    if (status && status !== 'not-started') {
        newTask.status = status;
    }

    const notes = document.getElementById('newTaskNotes').value.trim();
    if (notes) {
        newTask.notes = notes;
    }

    const tagsInput = document.getElementById('newTaskTags').value.trim();
    if (tagsInput) {
        // Parse tags: split by comma, trim whitespace, filter empty strings, convert to lowercase
        newTask.tags = tagsInput.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
            .map(tag => tag.toLowerCase());
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

                // Log time to Firestore for long-term tracking
                const projectName = taskData[section][groupIndex].groupName;
                logTimeToFirestore(task.title, projectName, task.estimatedMinutes, task.actualMinutes);
            }
        }

        // Save first, then show follow-up modal
        saveData();
        renderTasks();
        updateStats();
        updateProgress();

        // Show follow-up prompt
        showTaskFollowUpModal(task, section, groupIndex);
        return; // Exit early - saveData already called
    } else {
        // Uncompleting - just toggle
        task.completed = false;
    }

    saveData();
    renderTasks();
    updateStats();
    updateProgress();
}

// Task completion follow-up modal
let currentFollowUpContext = null;

window.showTaskFollowUpModal = function(task, section, groupIndex) {
    currentFollowUpContext = { task, section, groupIndex };

    document.getElementById('completedTaskTitle').textContent = task.title;
    document.getElementById('followUpNotes').value = '';
    document.getElementById('followUpTaskTitle').value = '';
    document.getElementById('followUpDueDate').value = '';
    document.getElementById('followUpTaskOptions').style.display = 'none';

    // Default to same section as completed task
    const sectionRadio = document.querySelector(`input[name="followUpSection"][value="${section}"]`);
    if (sectionRadio) sectionRadio.checked = true;

    document.getElementById('taskFollowUpModal').classList.add('active');

    // Show options when user starts typing a follow-up task
    document.getElementById('followUpTaskTitle').addEventListener('input', function() {
        document.getElementById('followUpTaskOptions').style.display = this.value.trim() ? 'block' : 'none';
    });
}

window.closeTaskFollowUpModal = function() {
    document.getElementById('taskFollowUpModal').classList.remove('active');
    currentFollowUpContext = null;
}

window.submitTaskFollowUp = function() {
    if (!currentFollowUpContext) {
        closeTaskFollowUpModal();
        return;
    }

    const { task, section, groupIndex } = currentFollowUpContext;
    const notes = document.getElementById('followUpNotes').value.trim();
    const followUpTitle = document.getElementById('followUpTaskTitle').value.trim();

    // Add notes to the completed task if provided
    if (notes) {
        if (!task.notes) {
            task.notes = '';
        }
        const timestamp = new Date().toLocaleDateString();
        task.notes += (task.notes ? '\n\n' : '') + `[Completed ${timestamp}] ${notes}`;
        saveData();
    }

    // Create follow-up task if provided
    if (followUpTitle) {
        const followUpSection = document.querySelector('input[name="followUpSection"]:checked').value;
        const followUpDueDate = document.getElementById('followUpDueDate').value.trim();

        const newTask = {
            title: followUpTitle,
            completed: false,
            status: 'not-started',
            createdAt: new Date().toISOString()
        };

        // Parse due date if provided
        if (followUpDueDate) {
            const parsedDate = parseNaturalDate(followUpDueDate);
            if (parsedDate) {
                newTask.dueDate = parsedDate;
            }
        }

        // Add to the same project/group as the original task
        taskData[followUpSection][groupIndex].tasks.push(newTask);
        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }

    closeTaskFollowUpModal();
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

// Toggle task status (cycle through statuses)
window.toggleTaskStatus = function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    const currentStatus = task.status || 'not-started';

    // Cycle through: not-started → planning → in-progress → completed → not-started
    const statusCycle = {
        'not-started': 'planning',
        'planning': 'in-progress',
        'in-progress': 'completed',
        'completed': 'not-started'
    };

    task.status = statusCycle[currentStatus];

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

// Archive entire project
window.archiveGroup = async function(section, groupIndex) {
    const group = taskData[section][groupIndex];
    const taskCount = group.tasks.length;
    const completedCount = group.tasks.filter(t => t.completed).length;

    const confirmMsg = taskCount > 0
        ? `Archive project "${group.groupName}"?\n\n${taskCount} task${taskCount === 1 ? '' : 's'} (${completedCount} completed) will be moved to the archive.`
        : `Archive empty project "${group.groupName}"?`;

    const shouldArchive = await showConfirmModal('📦 Archive Project', confirmMsg);

    if (shouldArchive) {
        const timestamp = new Date().toISOString();

        // Archive all tasks from this project
        group.tasks.forEach(task => {
            archivedTasks.push({
                ...task,
                archivedDate: timestamp,
                originalProject: group.groupName,
                originalSection: section,
                projectArchived: true // Mark that this came from a project archive
            });
        });

        // Also store a record of the project itself if it had tasks
        if (taskCount > 0) {
            archivedTasks.push({
                title: `[Project: ${group.groupName}]`,
                isProjectMarker: true,
                archivedDate: timestamp,
                originalProject: group.groupName,
                originalSection: section,
                taskCount: taskCount,
                completedCount: completedCount
            });
        }

        // Check if active task is in this group
        if (settings.activeTask &&
            settings.activeTask.section === section &&
            settings.activeTask.groupIndex === groupIndex) {
            settings.activeTask = null;
            clearFocusTimer();
        }

        // Remove the project
        taskData[section].splice(groupIndex, 1);

        // Adjust active task group index if archiving before it
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
    document.getElementById('taskEditStatus').value = task.status || 'not-started';
    document.getElementById('taskEditTags').value = task.tags ? task.tags.join(', ') : '';
    document.getElementById('taskEditNotes').value = task.notes || '';
    document.getElementById('taskEditIsBlocking').checked = task.isBlocking === true;
    document.getElementById('taskEditExternalDeadline').value = task.externalDeadline || '';
    document.getElementById('taskEditIsInFocus').checked = task.isInFocus === true;
    document.getElementById('taskEditZone').value = task.zone || '';

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

    // Update status
    const newStatus = document.getElementById('taskEditStatus').value;
    if (newStatus) {
        task.status = newStatus;
    } else {
        task.status = 'not-started';
    }

    // Update notes
    const newNotes = document.getElementById('taskEditNotes').value.trim();
    if (newNotes) {
        task.notes = newNotes;
    } else {
        delete task.notes;
    }

    // Update tags
    const tagsInput = document.getElementById('taskEditTags').value.trim();
    if (tagsInput) {
        // Parse tags: split by comma, trim whitespace, filter empty strings, convert to lowercase
        task.tags = tagsInput.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
            .map(tag => tag.toLowerCase());
    } else {
        delete task.tags;
    }

    // Update isBlocking
    const isBlocking = document.getElementById('taskEditIsBlocking').checked;
    if (isBlocking) {
        task.isBlocking = true;
    } else {
        delete task.isBlocking;
    }

    // Update externalDeadline
    const externalDeadline = document.getElementById('taskEditExternalDeadline').value;
    if (externalDeadline) {
        task.externalDeadline = externalDeadline;
    } else {
        delete task.externalDeadline;
    }

    // Update isInFocus
    const isInFocus = document.getElementById('taskEditIsInFocus').checked;
    if (isInFocus) {
        task.isInFocus = true;
    } else {
        delete task.isInFocus;
    }

    // Update zone
    const zone = document.getElementById('taskEditZone').value;
    if (zone) {
        task.zone = zone;
    } else {
        // Auto-update zone based on properties if not explicitly set
        updateTaskZoneProperties(task);
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
// Move task to a specific zone
window.moveTaskToZone = function(section, groupIndex, taskIndex, targetZone) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    if (!task) return;

    // Update zone property
    task.zone = targetZone;

    // Auto-update zone properties if moving to critical
    if (targetZone === 'critical') {
        if (!task.isBlocking) task.isBlocking = true;
    }

    saveData();
    renderTasks();
    updateStats();
    updateProgress();
}

// Toggle focus flag for a task
window.toggleFocus = function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    if (!task) return;

    // Toggle focus flag
    task.isInFocus = !task.isInFocus;

    // Auto-update zone if needed
    if (task.isInFocus) {
        // If not explicitly in critical zone, we can keep current zone
        // Focus tasks appear in both their zone and focus zone
    }

    saveData();
    renderTasks();
    updateStats();
    updateProgress();
}

// ===== REFINE INBOX MODAL =====
let refineInboxTasks = [];
let refineCurrentIndex = 0;
let refineMode = 'one'; // 'one' or 'batch'
let refineChanges = new Map(); // Track changes before saving

window.openRefineInboxModal = function() {
    // Get all inbox tasks
    refineInboxTasks = getTasksForInboxZone();
    
    if (refineInboxTasks.length === 0) {
        alert('No tasks in inbox to refine!');
        return;
    }
    
    refineCurrentIndex = 0;
    refineChanges.clear();
    
    // Reset mode to one-at-a-time
    refineMode = 'one';
    setRefineMode('one');
    
    // Load first task
    loadRefineTask();
    
    // Show modal
    document.getElementById('refineInboxModal').classList.add('active');
}

window.closeRefineInboxModal = function() {
    document.getElementById('refineInboxModal').classList.remove('active');
    refineInboxTasks = [];
    refineChanges.clear();
}

window.setRefineMode = function(mode) {
    refineMode = mode;
    
    // Update button states
    document.getElementById('refineModeOne').classList.toggle('active', mode === 'one');
    document.getElementById('refineModeBatch').classList.toggle('active', mode === 'batch');
    
    // Show/hide views
    document.getElementById('refineOneView').style.display = mode === 'one' ? 'block' : 'none';
    document.getElementById('refineBatchView').style.display = mode === 'batch' ? 'block' : 'none';
    
    if (mode === 'batch') {
        renderBatchView();
    } else {
        loadRefineTask();
    }
}

function loadRefineTask() {
    if (refineInboxTasks.length === 0) return;
    
    const taskMeta = refineInboxTasks[refineCurrentIndex];
    const task = taskData[taskMeta.section][taskMeta.groupIndex].tasks[taskMeta.taskIndex];
    
    // Get any pending changes for this task
    const taskKey = `${taskMeta.section}-${taskMeta.groupIndex}-${taskMeta.taskIndex}`;
    const changes = refineChanges.get(taskKey) || {};
    
    // Update UI
    document.getElementById('refineCurrentTaskTitle').textContent = task.title;
    document.getElementById('refineDueDate').value = changes.dueDate || task.dueDate || '';
    document.getElementById('refineExternalDeadline').value = changes.externalDeadline || task.externalDeadline || '';
    document.getElementById('refineTags').value = changes.tags || (task.tags ? task.tags.join(', ') : '');
    document.getElementById('refineNotes').value = changes.notes || task.notes || '';
    
    // Update quick action buttons
    const quickActions = document.getElementById('refineQuickActions');
    quickActions.innerHTML = `
        <button class="refine-quick-btn ${(changes.isBlocking || task.isBlocking) ? 'active' : ''}" 
                onclick="refineToggleQuick('isBlocking')" title="Mark as blocking others">👤 Blocking Others</button>
        <button class="refine-quick-btn ${(changes.isInFocus || task.isInFocus) ? 'active' : ''}" 
                onclick="refineToggleQuick('isInFocus')" title="Add to Today's Focus">🎯 Add to Focus</button>
        <button class="refine-quick-btn" onclick="refineQuickMove('critical')" title="Move to Critical zone">🚨 Move to Critical</button>
        <button class="refine-quick-btn" onclick="refineQuickMove('inbox')" title="Keep in Inbox">📥 Keep in Inbox</button>
    `;
    
    // Update counter and navigation
    document.getElementById('refineTaskCounter').textContent = `Task ${refineCurrentIndex + 1} of ${refineInboxTasks.length}`;
    document.getElementById('refinePrevBtn').disabled = refineCurrentIndex === 0;
    document.getElementById('refineNextBtn').disabled = refineCurrentIndex === refineInboxTasks.length - 1;
}

window.refineNextTask = function() {
    if (refineCurrentIndex < refineInboxTasks.length - 1) {
        refineCurrentIndex++;
        loadRefineTask();
    }
}

window.refinePreviousTask = function() {
    if (refineCurrentIndex > 0) {
        refineCurrentIndex--;
        loadRefineTask();
    }
}

window.refineSkipTask = function() {
    refineNextTask();
}

window.refineApplyToCurrent = function() {
    const taskMeta = refineInboxTasks[refineCurrentIndex];
    const taskKey = `${taskMeta.section}-${taskMeta.groupIndex}-${taskMeta.taskIndex}`;
    
    // Collect changes from form
    const changes = {
        dueDate: document.getElementById('refineDueDate').value.trim(),
        externalDeadline: document.getElementById('refineExternalDeadline').value,
        tags: document.getElementById('refineTags').value.trim(),
        notes: document.getElementById('refineNotes').value.trim()
    };
    
    // Apply quick toggles if set
    const quickActions = document.getElementById('refineQuickActions');
    const blockingBtn = quickActions.querySelector('[onclick*="isBlocking"]');
    const focusBtn = quickActions.querySelector('[onclick*="isInFocus"]');
    
    const existingChanges = refineChanges.get(taskKey) || {};
    
    if (blockingBtn && blockingBtn.classList.contains('active')) {
        changes.isBlocking = true;
    } else if (existingChanges.isBlocking === undefined) {
        // Only clear if not explicitly set
        changes.isBlocking = false;
    }
    
    if (focusBtn && focusBtn.classList.contains('active')) {
        changes.isInFocus = true;
    } else if (existingChanges.isInFocus === undefined) {
        changes.isInFocus = false;
    }
    
    // Merge with existing changes
    refineChanges.set(taskKey, { ...existingChanges, ...changes });
    
    // Move to next task
    refineNextTask();
}

window.refineToggleQuick = function(property) {
    const taskMeta = refineInboxTasks[refineCurrentIndex];
    const taskKey = `${taskMeta.section}-${taskMeta.groupIndex}-${taskMeta.taskIndex}`;
    const task = taskData[taskMeta.section][taskMeta.groupIndex].tasks[taskMeta.taskIndex];
    const changes = refineChanges.get(taskKey) || {};
    
    // Determine current value (changes override task)
    const currentValue = changes[property] !== undefined ? changes[property] : (task[property] === true);
    
    // Toggle the property
    changes[property] = !currentValue;
    refineChanges.set(taskKey, changes);
    
    // Update button state
    const btn = event.target.closest('.refine-quick-btn');
    if (btn) {
        btn.classList.toggle('active', changes[property]);
    } else {
        // Reload to refresh all button states
        loadRefineTask();
    }
}

window.refineQuickMove = function(zone) {
    const taskMeta = refineInboxTasks[refineCurrentIndex];
    const taskKey = `${taskMeta.section}-${taskMeta.groupIndex}-${taskMeta.taskIndex}`;
    const changes = refineChanges.get(taskKey) || {};
    
    changes.zone = zone;
    refineChanges.set(taskKey, changes);
    
    // Move to next task
    refineNextTask();
}

function renderBatchView() {
    const container = document.getElementById('refineBatchTaskList');
    
    if (refineInboxTasks.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No tasks in inbox</div>';
        return;
    }
    
    container.innerHTML = refineInboxTasks.map((taskMeta, index) => {
        const task = taskData[taskMeta.section][taskMeta.groupIndex].tasks[taskMeta.taskIndex];
        const taskKey = `${taskMeta.section}-${taskMeta.groupIndex}-${taskMeta.taskIndex}`;
        const changes = refineChanges.get(taskKey) || {};
        
        return `
            <div class="refine-task-item" onclick="refineEditInBatch(${index})">
                <div class="refine-task-item-title">${escapeHtml(task.title)}</div>
                <div class="refine-batch-actions">
                    <button class="refine-quick-btn ${(changes.isBlocking || task.isBlocking) ? 'active' : ''}" 
                            onclick="event.stopPropagation(); refineBatchToggle(${index}, 'isBlocking')">👤 Blocking</button>
                    <button class="refine-quick-btn ${(changes.isInFocus || task.isInFocus) ? 'active' : ''}" 
                            onclick="event.stopPropagation(); refineBatchToggle(${index}, 'isInFocus')">🎯 Focus</button>
                    <button class="refine-quick-btn ${changes.zone === 'critical' || task.zone === 'critical' ? 'active' : ''}" 
                            onclick="event.stopPropagation(); refineBatchSetZone(${index}, 'critical')">🚨 Critical</button>
                </div>
            </div>
        `;
    }).join('');
}

window.refineEditInBatch = function(index) {
    refineCurrentIndex = index;
    setRefineMode('one');
    loadRefineTask();
}

window.refineBatchToggle = function(index, property) {
    const taskMeta = refineInboxTasks[index];
    const taskKey = `${taskMeta.section}-${taskMeta.groupIndex}-${taskMeta.taskIndex}`;
    const changes = refineChanges.get(taskKey) || {};
    const task = taskData[taskMeta.section][taskMeta.groupIndex].tasks[taskMeta.taskIndex];
    
    changes[property] = !(changes[property] || task[property] === true);
    refineChanges.set(taskKey, changes);
    
    renderBatchView();
}

window.refineBatchSetZone = function(index, zone) {
    const taskMeta = refineInboxTasks[index];
    const taskKey = `${taskMeta.section}-${taskMeta.groupIndex}-${taskMeta.taskIndex}`;
    const changes = refineChanges.get(taskKey) || {};
    
    changes.zone = zone;
    refineChanges.set(taskKey, changes);
    
    renderBatchView();
}

window.refineSaveAll = function() {
    // Apply all changes to tasks
    refineChanges.forEach((changes, taskKey) => {
        const parts = taskKey.split('-');
        const section = parts[0];
        const groupIndex = parseInt(parts[1]);
        const taskIndex = parseInt(parts[2]);
        
        if (!taskData[section] || !taskData[section][groupIndex] || !taskData[section][groupIndex].tasks[taskIndex]) {
            return;
        }
        
        const task = taskData[section][groupIndex].tasks[taskIndex];
        
        // Apply all changes
        if (changes.dueDate !== undefined) {
            if (changes.dueDate) {
                // Parse natural language date
                const parsedDate = parseNaturalDate(changes.dueDate);
                task.dueDate = parsedDate || changes.dueDate;
            } else {
                delete task.dueDate;
            }
        }
        
        if (changes.externalDeadline !== undefined) {
            if (changes.externalDeadline) {
                task.externalDeadline = changes.externalDeadline;
            } else {
                delete task.externalDeadline;
            }
        }
        
        if (changes.tags !== undefined) {
            if (changes.tags) {
                task.tags = changes.tags.split(',').map(t => t.trim()).filter(t => t).map(t => t.toLowerCase());
            } else {
                delete task.tags;
            }
        }
        
        if (changes.notes !== undefined) {
            if (changes.notes) {
                task.notes = changes.notes;
            } else {
                delete task.notes;
            }
        }
        
        if (changes.isBlocking !== undefined) {
            if (changes.isBlocking) {
                task.isBlocking = true;
            } else {
                delete task.isBlocking;
            }
        }
        
        if (changes.isInFocus !== undefined) {
            if (changes.isInFocus) {
                task.isInFocus = true;
            } else {
                delete task.isInFocus;
            }
        }
        
        if (changes.zone !== undefined) {
            task.zone = changes.zone;
        }
        
        // Auto-update zone properties
        updateTaskZoneProperties(task);
    });
    
    saveData();
    renderTasks();
    updateStats();
    updateProgress();
    
    closeRefineInboxModal();
}

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

// Convert a task to a new project
window.convertToProject = async function(section, groupIndex, taskIndex) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    const taskTitle = task.title;

    // Ask for project name (default to task title)
    const projectName = await showCustomModal(
        '📁 Convert to Project',
        `Create a new project from this task?\n\nTask: "${taskTitle}"\n\nEnter project name:`,
        taskTitle
    );

    if (!projectName || !projectName.trim()) return;

    // Ask which section to create the project in using choice modal
    const targetSection = await showChoiceModal(
        '📍 Choose Location',
        `Where should "${projectName.trim()}" be created?`,
        [
            {
                value: 'today',
                label: "Today's Tasks",
                icon: '⚡',
                description: 'For projects you want to work on today'
            },
            {
                value: 'longterm',
                label: 'Ongoing Projects',
                icon: '📅',
                description: 'For longer-term projects and goals'
            }
        ]
    );

    if (!targetSection) return; // User cancelled

    // Remove task from current group
    taskData[section][groupIndex].tasks.splice(taskIndex, 1);

    // Remove group if empty
    if (taskData[section][groupIndex].tasks.length === 0) {
        taskData[section].splice(groupIndex, 1);
    }

    // Create new project with the task as a subtask or note
    const newProject = {
        groupName: projectName.trim(),
        tasks: []
    };

    // If the original task had subtasks, convert them to tasks
    if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
            newProject.tasks.push({
                title: subtask.title,
                completed: subtask.completed
            });
        });
    }

    // Add the new project to the target section
    taskData[targetSection].push(newProject);

    saveData();
    renderTasks();
    updateStats();
    updateProgress();

    // Offer to use AI to break down the project using confirm modal
    const successMessage = newProject.tasks.length > 0
        ? `Project created with ${newProject.tasks.length} tasks from subtasks.\n\nWould you like AI to suggest additional tasks?`
        : `Would you like AI to suggest tasks for this project?`;

    const useAI = await showConfirmModal(
        `✅ Project Created!`,
        successMessage
    );

    if (useAI) {
        // Find the new project's index
        const newProjectIndex = taskData[targetSection].length - 1;
        aiBreakdownProject(targetSection, newProjectIndex);
    }
}

// Brain dump handler - zero friction task capture
window.handleBrainDump = function(event) {
    if (event.key === 'Enter') {
        const input = document.getElementById('brainDumpInput');
        const title = input.value.trim();

        if (!title) return;

        // Create task with minimal properties, add to inbox zone
        const newTask = {
            title: title,
            completed: false,
            zone: 'inbox'
        };

        // Add to "Quick Tasks" group in longterm section (or create it)
        let quickGroup = taskData.longterm.find(g => g.groupName === 'Quick Tasks');
        if (!quickGroup) {
            quickGroup = { groupName: 'Quick Tasks', tasks: [] };
            taskData.longterm.unshift(quickGroup);
        }

        quickGroup.tasks.push(newTask);
        input.value = '';
        input.focus(); // Keep focus for rapid entry

        saveData();
        renderTasks();
        updateStats();
        updateProgress();
    }
}

// Global keyboard shortcut to focus brain dump input
document.addEventListener('DOMContentLoaded', function() {
    // Focus brain dump input on load
    setTimeout(() => {
        const brainDumpInput = document.getElementById('brainDumpInput');
        if (brainDumpInput) {
            brainDumpInput.focus();
        }
    }, 100);

    // Keyboard shortcut: Space (when not typing) or Cmd/Ctrl+K
    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        );

        // Space bar shortcut (only when not in an input)
        if (e.key === ' ' && !isInputFocused && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const brainDumpInput = document.getElementById('brainDumpInput');
            if (brainDumpInput) {
                brainDumpInput.focus();
            }
        }

        // Cmd/Ctrl+K shortcut
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            const brainDumpInput = document.getElementById('brainDumpInput');
            if (brainDumpInput) {
                brainDumpInput.focus();
            }
        }
    });
});

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

// ==================== NOTES SECTION ====================

let activeNoteTagFilter = null; // null means show all

function saveNotes() {
    localStorage.setItem('notes', JSON.stringify(notes));
    // Also sync to Firestore if available
    if (window.firestore && typeof syncToFirestore === 'function') {
        syncToFirestore();
    }
}

function getAllNoteTags() {
    const tagSet = new Set();
    notes.forEach(note => {
        if (note.tags && Array.isArray(note.tags)) {
            note.tags.forEach(tag => tagSet.add(tag));
        }
    });
    return Array.from(tagSet).sort();
}

function renderNoteTagFilters() {
    const container = document.getElementById('notesTagFilter');
    if (!container) return;

    const allTags = getAllNoteTags();
    if (allTags.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <button class="tag-filter-btn all-notes ${activeNoteTagFilter === null ? 'active' : ''}"
                onclick="filterNotesByTag(null)">All</button>
        ${allTags.map(tag => `
            <button class="tag-filter-btn ${activeNoteTagFilter === tag ? 'active' : ''}"
                    onclick="filterNotesByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</button>
        `).join('')}
    `;
}

window.filterNotesByTag = function(tag) {
    activeNoteTagFilter = tag;
    renderNoteTagFilters();
    renderNotes();
}

function renderNotes() {
    const container = document.getElementById('notesList');
    if (!container) return;

    // Also render tag filters
    renderNoteTagFilters();

    if (notes.length === 0) {
        container.innerHTML = '<div class="notes-empty">No notes yet. Click + to add one.</div>';
        return;
    }

    // Filter notes by active tag
    let filteredNotes = notes;
    if (activeNoteTagFilter !== null) {
        filteredNotes = notes.filter(note =>
            note.tags && note.tags.includes(activeNoteTagFilter)
        );
    }

    if (filteredNotes.length === 0) {
        container.innerHTML = `<div class="notes-empty">No notes with tag "${escapeHtml(activeNoteTagFilter)}"</div>`;
        return;
    }

    container.innerHTML = filteredNotes.map((note) => {
        const actualIndex = notes.indexOf(note);
        const tagsHtml = note.tags && note.tags.length > 0
            ? `<div class="note-tags">${note.tags.map(tag =>
                `<span class="note-tag">${escapeHtml(tag)}</span>`
              ).join('')}</div>`
            : '';

        return `
            <div class="note-item" data-index="${actualIndex}">
                <div class="note-content" onclick="editNote(${actualIndex})">${escapeHtml(note.content)}</div>
                ${tagsHtml}
                <div class="note-timestamp">${formatNoteDate(note.updatedAt || note.createdAt)}</div>
                <div class="note-actions">
                    <button class="note-action-btn" onclick="editNote(${actualIndex})">Edit</button>
                    <button class="note-action-btn delete" onclick="deleteNote(${actualIndex})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function formatNoteDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

window.addNewNote = function() {
    const newNote = {
        id: Date.now(),
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    notes.unshift(newNote);
    saveNotes();
    renderNotes();
    // Immediately edit the new note
    editNote(0);
}

window.editNote = function(index) {
    const container = document.getElementById('notesList');
    const noteItem = container.querySelector(`[data-index="${index}"]`);
    if (!noteItem || noteItem.classList.contains('editing')) return;

    const note = notes[index];
    if (!note.tags) note.tags = [];

    noteItem.classList.add('editing');

    // Store original values for cancel
    window._editingNoteOriginal = {
        content: note.content,
        tags: [...note.tags]
    };
    window._editingNoteIndex = index;

    const contentDiv = noteItem.querySelector('.note-content');

    // Get all existing tags for suggestions
    const allTags = getAllNoteTags();
    const availableTags = allTags.filter(t => !note.tags.includes(t));

    contentDiv.innerHTML = `
        <textarea class="note-textarea" placeholder="Write your note...">${escapeHtml(note.content)}</textarea>
    `;

    // Create tag editing section
    const tagEditHtml = `
        <div class="note-tag-input-wrapper">
            ${note.tags.map(tag => `
                <span class="note-tag">
                    ${escapeHtml(tag)}
                    <span class="note-tag-remove" onclick="removeNoteTag(${index}, '${escapeHtml(tag)}')">&times;</span>
                </span>
            `).join('')}
            <input type="text" class="note-tag-input" placeholder="Add tag..."
                   onkeydown="handleNoteTagInput(event, ${index})">
        </div>
        ${availableTags.length > 0 ? `
            <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
                ${availableTags.slice(0, 5).map(tag => `
                    <button class="existing-tag-btn" onclick="addExistingTagToNote(${index}, '${escapeHtml(tag)}')"
                            title="Add tag">+ ${escapeHtml(tag)}</button>
                `).join('')}
            </div>
        ` : ''}
    `;

    // Insert tag editing after content
    let tagEditContainer = noteItem.querySelector('.note-tag-edit');
    if (!tagEditContainer) {
        tagEditContainer = document.createElement('div');
        tagEditContainer.className = 'note-tag-edit';
        contentDiv.after(tagEditContainer);
    }
    tagEditContainer.innerHTML = tagEditHtml;

    // Replace the actions with Save/Cancel buttons
    const actionsDiv = noteItem.querySelector('.note-actions');
    actionsDiv.innerHTML = `
        <button class="note-action-btn save-btn" onclick="saveEditingNote(${index})">Save</button>
        <button class="note-action-btn cancel-btn" onclick="cancelEditingNote(${index})">Cancel</button>
    `;
    actionsDiv.style.opacity = '1';

    const textarea = contentDiv.querySelector('.note-textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    // Auto-resize textarea
    const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };
    autoResize();
    textarea.addEventListener('input', autoResize);

    // Save on Ctrl+Enter or Cmd+Enter
    textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            saveEditingNote(index);
        }
        // Cancel on Escape
        if (e.key === 'Escape') {
            cancelEditingNote(index);
        }
    });
}

window.saveEditingNote = function(index) {
    const container = document.getElementById('notesList');
    const noteItem = container.querySelector(`[data-index="${index}"]`);
    if (!noteItem) return;

    const textarea = noteItem.querySelector('.note-textarea');
    const newContent = textarea ? textarea.value.trim() : notes[index].content;

    // Check if note is empty and was originally empty (new note)
    const original = window._editingNoteOriginal;
    if (newContent === '' && original && original.content === '' && notes[index].tags.length === 0) {
        // Delete empty new note
        notes.splice(index, 1);
    } else {
        notes[index].content = newContent;
        notes[index].updatedAt = new Date().toISOString();
    }

    saveNotes();
    renderNotes();
    window._editingNoteOriginal = null;
    window._editingNoteIndex = null;
}

window.cancelEditingNote = function(index) {
    const original = window._editingNoteOriginal;
    if (original) {
        // Check if this was a new empty note
        if (original.content === '' && original.tags.length === 0) {
            // Delete the empty note we created
            notes.splice(index, 1);
        } else {
            // Restore original values
            notes[index].content = original.content;
            notes[index].tags = original.tags;
        }
    }
    renderNotes();
    window._editingNoteOriginal = null;
    window._editingNoteIndex = null;
}

window.handleNoteTagInput = function(event, noteIndex) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const input = event.target;
        const tagName = input.value.trim().toLowerCase();

        if (tagName && !notes[noteIndex].tags.includes(tagName)) {
            notes[noteIndex].tags.push(tagName);
            notes[noteIndex].updatedAt = new Date().toISOString();
            saveNotes();
            // Re-render just the editing state
            editNote(noteIndex);
        }
        input.value = '';
    }
}

window.addExistingTagToNote = function(noteIndex, tagName) {
    if (!notes[noteIndex].tags.includes(tagName)) {
        notes[noteIndex].tags.push(tagName);
        notes[noteIndex].updatedAt = new Date().toISOString();
        saveNotes();
        editNote(noteIndex);
    }
}

window.removeNoteTag = function(noteIndex, tagName) {
    const tagIdx = notes[noteIndex].tags.indexOf(tagName);
    if (tagIdx > -1) {
        notes[noteIndex].tags.splice(tagIdx, 1);
        notes[noteIndex].updatedAt = new Date().toISOString();
        saveNotes();
        editNote(noteIndex);
    }
}

window.deleteNote = async function(index) {
    const note = notes[index];
    const preview = note.content.substring(0, 50) + (note.content.length > 50 ? '...' : '');

    const shouldDelete = await showConfirmModal(
        '🗑️ Delete Note',
        `Delete this note?\n\n"${preview || '(empty note)'}"`
    );

    if (shouldDelete) {
        notes.splice(index, 1);
        saveNotes();
        renderNotes();
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
        console.log('⚠️ Cannot start focus timer: no active task or interval');
        return;
    }
    
    // Verify the active task still exists
    const { section, groupIndex, taskIndex } = settings.activeTask;
    if (!taskData[section] || !taskData[section][groupIndex] || !taskData[section][groupIndex].tasks[taskIndex]) {
        // Task no longer exists, clear focus
        console.log('⚠️ Focus task no longer exists, clearing focus');
        settings.activeTask = null;
        saveData();
        return;
    }
    
    const intervalMs = settings.activeTask.alertInterval * 60 * 1000; // Convert minutes to milliseconds
    const now = Date.now();
    
    // Initialize timing - if this is a new focus session, set start time
    // If resuming, use existing start time but reset lastAlertTime to now so we wait full interval
    if (!settings.activeTask.startTime) {
        // New focus session - start counting from now
        settings.activeTask.startTime = now;
        settings.activeTask.lastAlertTime = now; // First alert will be after full interval
        console.log('✅ Starting new focus session, first alert in', settings.activeTask.alertInterval, 'minutes');
    } else {
        // Resuming - keep start time but update lastAlertTime to now to wait full interval
        settings.activeTask.lastAlertTime = now;
        console.log('✅ Resuming focus session, next alert in', settings.activeTask.alertInterval, 'minutes');
    }
    
    // Store in global variables for quick access
    focusStartTime = settings.activeTask.startTime;
    lastAlertTime = settings.activeTask.lastAlertTime;
    
    // Save the updated timing
    saveData();
    
    // Use a more frequent check interval (every 10 seconds) to catch up if tab was in background
    const checkInterval = 10000; // Check every 10 seconds for better responsiveness
    
    focusTimer = setInterval(() => {
        checkFocusAlert(intervalMs);
    }, checkInterval);
    
    console.log('✅ Focus timer started, checking every', checkInterval / 1000, 'seconds');
    
    // Also check when tab becomes visible (handles background tab case)
    // Use a named function to prevent duplicate listeners
    if (!window._focusVisibilityHandler) {
        window._focusVisibilityHandler = handleVisibilityChange;
        document.addEventListener('visibilitychange', window._focusVisibilityHandler);
    }
}

function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && settings.activeTask && settings.activeTask.alertInterval) {
        // Tab became visible - check if we missed any alerts
        const intervalMs = settings.activeTask.alertInterval * 60 * 1000;
        console.log('👁️ Tab became visible, checking for missed alerts');
        checkFocusAlert(intervalMs);
    }
}

function checkFocusAlert(intervalMs) {
    if (!settings.activeTask) {
        clearFocusTimer();
        return;
    }
    
    // Verify task still exists
    const { section, groupIndex, taskIndex } = settings.activeTask;
    if (!taskData[section] || !taskData[section][groupIndex] || !taskData[section][groupIndex].tasks[taskIndex]) {
        console.log('⚠️ Focus task no longer exists during check');
        settings.activeTask = null;
        saveData();
        clearFocusTimer();
        return;
    }
    
    const now = Date.now();
    
    // Always use the stored time from activeTask (persists across reloads)
    const storedLastAlert = settings.activeTask.lastAlertTime || now;
    
    // Calculate time since last alert
    const timeSinceLastAlert = now - storedLastAlert;
    const minutesSinceLastAlert = Math.floor(timeSinceLastAlert / 60000);
    const requiredMinutes = settings.activeTask.alertInterval;
    
    // Debug logging (only log occasionally to avoid spam)
    if (Math.random() < 0.01) { // Log 1% of checks
        console.log(`⏱️ Focus check: ${minutesSinceLastAlert}/${requiredMinutes} minutes elapsed`);
    }
    
    // If enough time has passed, show alert
    if (timeSinceLastAlert >= intervalMs) {
        console.log('🔔 Time for focus alert!');
        showFocusAlert();
        // lastAlertTime is updated inside showFocusAlert
    }
}

function clearFocusTimer() {
    if (focusTimer) {
        clearInterval(focusTimer);
        focusTimer = null;
        console.log('🛑 Focus timer cleared');
    }
    focusStartTime = null;
    lastAlertTime = null;
    
    // Remove visibility change listener if it exists
    if (window._focusVisibilityHandler) {
        document.removeEventListener('visibilitychange', window._focusVisibilityHandler);
        window._focusVisibilityHandler = null;
    }
}

function showFocusAlert() {
    console.log('🔔 showFocusAlert called');
    
    if (!settings.activeTask) {
        console.log('⚠️ No active task in showFocusAlert');
        clearFocusTimer();
        return;
    }
    
    const { section, groupIndex, taskIndex, websiteUrl } = settings.activeTask;
    
    // Verify task still exists
    if (!taskData[section] || !taskData[section][groupIndex] || !taskData[section][groupIndex].tasks[taskIndex]) {
        console.log('⚠️ Task no longer exists in showFocusAlert');
        settings.activeTask = null;
        saveData();
        clearFocusTimer();
        return;
    }
    
    const task = taskData[section][groupIndex].tasks[taskIndex];
    const taskTitle = task.title;
    
    console.log('✅ Showing alert for task:', taskTitle);
    
    // Update last alert time BEFORE showing alert (prevents rapid-fire alerts)
    const now = Date.now();
    lastAlertTime = now;
    if (settings.activeTask) {
        settings.activeTask.lastAlertTime = now;
        saveData(); // Save to persist across page reloads
    }
    
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
    
    // Use event delegation to handle button clicks (more reliable)
    const handleContinue = (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeDialog();
        // Timer continues automatically
    };
    
    const handleStop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeDialog();
        // Stop focusing
        toggleFocusTask(section, groupIndex, taskIndex);
    };
    
    // Attach event listeners after a brief delay to ensure DOM is ready
    setTimeout(() => {
        const continueBtn = document.getElementById('focusAlertContinue');
        const stopBtn = document.getElementById('focusAlertStop');
        
        if (continueBtn) {
            continueBtn.addEventListener('click', handleContinue, { once: true });
            continueBtn.focus(); // Focus for keyboard accessibility
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', handleStop, { once: true });
        }
    }, 10);
    
    // Close dialog when clicking outside (optional)
    alertDiv.addEventListener('click', (e) => {
        if (e.target === alertDiv) {
            removeDialog();
        }
    });
}

// Focus mode setup modal functions
let focusSetupCallback = null;
let focusSetupTaskInfo = null;

window.setFocusInterval = function(minutes) {
    const input = document.getElementById('focusAlertIntervalInput');
    if (input) {
        input.value = minutes;
        // Highlight the selected button
        const buttons = input.parentElement.querySelectorAll('button');
        buttons.forEach((btn, index) => {
            btn.classList.remove('selected');
            btn.style.background = 'rgba(102, 126, 234, 0.1)';
            btn.style.color = '#667eea';
            // Check if this button matches the selected value
            const buttonValue = index === 0 ? 5 : index === 1 ? 10 : 15;
            if (buttonValue === minutes) {
                btn.classList.add('selected');
                btn.style.background = '#667eea';
                btn.style.color = 'white';
            }
        });
    }
}

window.showFocusSetupModal = function(section, groupIndex, taskIndex, callback) {
    const task = taskData[section][groupIndex].tasks[taskIndex];
    focusSetupTaskInfo = { section, groupIndex, taskIndex };
    focusSetupCallback = callback;
    
    document.getElementById('focusSetupTaskTitle').textContent = task.title;
    const intervalInput = document.getElementById('focusAlertIntervalInput');
    const defaultInterval = settings.focusAlertInterval || 10;
    intervalInput.value = defaultInterval;
    document.getElementById('focusWebsiteUrlInput').value = '';
    
    // Load URL suggestions
    updateUrlSuggestions();
    
    // Set initial button selection based on default interval
    setFocusInterval(defaultInterval);
    
    document.getElementById('focusSetupModal').classList.add('active');
    intervalInput.focus();
    
    // Handle Enter key on inputs
    intervalInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            document.getElementById('focusWebsiteUrlInput').focus();
        } else {
            // Update button selection when typing
            const val = parseInt(e.target.value);
            if (!isNaN(val) && val >= 1 && val <= 15) {
                setFocusInterval(val);
            }
        }
    };
    
    intervalInput.oninput = (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val >= 1 && val <= 15) {
            setFocusInterval(val);
        }
    };
    
    document.getElementById('focusWebsiteUrlInput').onkeydown = (e) => {
        if (e.key === 'Enter') {
            submitFocusSetup();
        }
    };
}

window.closeFocusSetupModal = function() {
    document.getElementById('focusSetupModal').classList.remove('active');
    focusSetupCallback = null;
    focusSetupTaskInfo = null;
}

window.submitFocusSetup = function() {
    if (!focusSetupTaskInfo) return;
    
    const intervalInput = document.getElementById('focusAlertIntervalInput').value;
    const websiteInput = document.getElementById('focusWebsiteUrlInput').value.trim();
    
    let alertInterval = parseInt(intervalInput);
    if (isNaN(alertInterval) || alertInterval < 1 || alertInterval > 15) {
        showCustomAlert('Please enter a valid interval: 1-15 minutes.');
        return;
    }
    
    let websiteUrl = null;
    if (websiteInput !== '') {
        // Validate and format URL
        let url = websiteInput;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        try {
            new URL(url); // Validate URL
            websiteUrl = url;
            
            // Save URL to suggestions
            if (!settings.savedUrls) {
                settings.savedUrls = [];
            }
            if (!settings.savedUrls.includes(url)) {
                settings.savedUrls.push(url);
                // Keep only last 10 URLs
                if (settings.savedUrls.length > 10) {
                    settings.savedUrls = settings.savedUrls.slice(-10);
                }
                saveData();
            }
        } catch (e) {
            showCustomAlert('Invalid URL format. Please enter a valid URL (e.g., example.com or https://example.com)');
            return;
        }
    }
    
    // Execute callback BEFORE closing modal (which nullifies the callback)
    if (focusSetupCallback) {
        const callback = focusSetupCallback; // Store reference before closing
        closeFocusSetupModal();
        callback(alertInterval, websiteUrl);
    } else {
        closeFocusSetupModal();
    }
}

function updateUrlSuggestions() {
    const datalist = document.getElementById('focusUrlSuggestions');
    if (!datalist) return;
    
    datalist.innerHTML = '';
    
    if (settings.savedUrls && settings.savedUrls.length > 0) {
        settings.savedUrls.forEach(url => {
            const option = document.createElement('option');
            option.value = url;
            datalist.appendChild(option);
        });
    }
}

// Custom styled alert function (replaces native alert)
function showCustomAlert(message, title = '⚠️') {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%);
        backdrop-filter: blur(20px);
        padding: 30px;
        border-radius: 20px;
        box-shadow: 0 15px 45px rgba(0,0,0,0.5);
        z-index: 10001;
        max-width: 400px;
        text-align: center;
        border: 2px solid rgba(255, 255, 255, 0.5);
    `;
    
    alertDiv.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 15px;">${title}</div>
        <div style="font-size: 16px; font-weight: 500; color: white; margin-bottom: 20px; line-height: 1.5;">
            ${message.replace(/\n/g, '<br>')}
        </div>
        <button onclick="this.parentElement.remove()" 
                style="padding: 10px 30px; background: rgba(255, 255, 255, 0.9); color: #333; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 16px;">
            OK
        </button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-focus button
    setTimeout(() => alertDiv.querySelector('button').focus(), 100);
    
    // Close on Escape
    const handleKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
            alertDiv.remove();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
}

window.toggleFocusTask = function(section, groupIndex, taskIndex) {
    // IMPORTANT: When tasks are reordered, the focused task is moved to index 0
    // So we need to check if the current taskIndex matches the stored one OR if it's at index 0
    const isCurrentlyActive = settings.activeTask &&
        settings.activeTask.section === section &&
        settings.activeTask.groupIndex === groupIndex &&
        (settings.activeTask.taskIndex === taskIndex || 
         (taskIndex === 0 && settings.activeTask.taskIndex === 0 && 
          taskData[section][groupIndex].tasks[0] && 
          taskData[section][groupIndex].tasks[0].title === 
          taskData[section][groupIndex].tasks[settings.activeTask.taskIndex]?.title));
    
    if (isCurrentlyActive) {
        // Stop focusing
        settings.activeTask = null;
        clearFocusTimer();
        saveData();
        renderTasks();
        showCustomAlert('Focus mode stopped for this task.', '🎯');
    } else {
        // Show setup modal
        showFocusSetupModal(section, groupIndex, taskIndex, (alertInterval, websiteUrl) => {
            // Start focusing
            settings.activeTask = {
                section,
                groupIndex,
                taskIndex,
                alertInterval,
                websiteUrl,
                startTime: Date.now(), // Store when focus started
                lastAlertTime: Date.now() // Store when last alert was shown
            };
            
            startFocusTimer();
            saveData();
            renderTasks();
            
            // Show confirmation
            const task = taskData[section][groupIndex].tasks[taskIndex];
            let confirmMsg = `Now focusing on: "${task.title}"<br><br>You'll receive alerts every ${alertInterval} minutes.`;
            if (websiteUrl) {
                confirmMsg += `<br><br>🌐 Website linked: ${websiteUrl}`;
            }
            showCustomAlert(confirmMsg, '🎯');
        });
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
        showCustomAlert('No task is currently focused.<br><br>Please click the 🎯 button on a task first to enable focus mode.', '⚠️');
        return;
    }
    
    const { section, groupIndex, taskIndex } = settings.activeTask;
    
    // Verify task still exists
    if (!taskData[section] || !taskData[section][groupIndex] || !taskData[section][groupIndex].tasks[taskIndex]) {
        showCustomAlert('The focused task no longer exists.', '⚠️');
        settings.activeTask = null;
        saveData();
        return;
    }
    
    console.log('🧪 Testing focus alert...');
    // Show the alert immediately for testing (but don't update lastAlertTime so timer continues)
    const task = taskData[section][groupIndex].tasks[taskIndex];
    showFocusAlertDialog(section, groupIndex, taskIndex, task.title, settings.activeTask.websiteUrl);
}

// Debug function to check timer status
window.debugFocusTimer = function() {
    console.log('=== Focus Timer Debug ===');
    console.log('Active Task:', settings.activeTask);
    console.log('Focus Timer ID:', focusTimer);
    console.log('Focus Start Time:', focusStartTime ? new Date(focusStartTime).toLocaleString() : 'null');
    console.log('Last Alert Time:', lastAlertTime ? new Date(lastAlertTime).toLocaleString() : 'null');
    
    if (settings.activeTask) {
        const now = Date.now();
        const intervalMs = settings.activeTask.alertInterval * 60 * 1000;
        const storedLastAlert = settings.activeTask.lastAlertTime || lastAlertTime || settings.activeTask.startTime || now;
        const timeSinceLastAlert = now - storedLastAlert;
        const minutesSince = Math.floor(timeSinceLastAlert / 60000);
        const minutesUntil = Math.ceil((intervalMs - timeSinceLastAlert) / 60000);
        
        console.log('Alert Interval:', settings.activeTask.alertInterval, 'minutes');
        console.log('Time since last alert:', minutesSince, 'minutes');
        console.log('Time until next alert:', minutesUntil > 0 ? minutesUntil + ' minutes' : 'DUE NOW');
        
        if (settings.activeTask.startTime) {
            const totalTime = now - settings.activeTask.startTime;
            console.log('Total focus time:', Math.floor(totalTime / 60000), 'minutes');
        }
    }
    
    const status = {
        hasActiveTask: !!settings.activeTask,
        timerRunning: focusTimer !== null,
        taskInfo: settings.activeTask
    };
    
    showCustomAlert(
        `Focus Timer Status:<br><br>` +
        `Active Task: ${status.hasActiveTask ? 'Yes ✅' : 'No ❌'}<br>` +
        `Timer Running: ${status.timerRunning ? 'Yes ✅' : 'No ❌'}<br>` +
        (status.hasActiveTask ? `<br>Task: "${taskData[settings.activeTask.section][settings.activeTask.groupIndex].tasks[settings.activeTask.taskIndex].title}"<br>` +
        `Interval: ${settings.activeTask.alertInterval} minutes` : ''),
        '🔍'
    );
    
    return status;
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

// Save data to localStorage with backup and sync to Firestore
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

        // Save current data to localStorage
        localStorage.setItem('taskData', JSON.stringify(taskData));
        localStorage.setItem('archivedTasks', JSON.stringify(archivedTasks));
        localStorage.setItem('settings', JSON.stringify(settings));
        localStorage.setItem('taskData_lastSaved', Date.now().toString());

        // Sync to Firestore (non-blocking)
        syncToFirestore();
    } catch (error) {
        console.error('Error saving data:', error);
        alert('Warning: Failed to save task data. Please check your browser storage.');
    }
}

// Sync data to Firestore cloud database
async function syncToFirestore() {
    if (!window.firestore) {
        console.log('Firestore not ready yet');
        return;
    }

    try {
        updateSyncStatus('syncing');
        const result = await window.firestore.saveTaskData(taskData, archivedTasks, settings);
        if (result.success) {
            updateSyncStatus('synced');
        } else {
            updateSyncStatus('error');
            console.error('Firestore sync failed:', result.error);
        }
    } catch (error) {
        updateSyncStatus('error');
        console.error('Firestore sync error:', error);
    }
}

// Load data from Firestore (called on startup if localStorage is empty or user requests cloud sync)
async function loadFromFirestore() {
    if (!window.firestore) {
        console.log('Firestore not ready yet');
        return false;
    }

    try {
        updateSyncStatus('syncing');
        const result = await window.firestore.loadTaskData();
        if (result.success && result.data) {
            // Update local data with Firestore data
            if (result.data.taskData) taskData = result.data.taskData;
            if (result.data.archivedTasks) archivedTasks = result.data.archivedTasks;
            if (result.data.settings) {
                settings = { ...settings, ...result.data.settings };
            }
            // Save to localStorage
            localStorage.setItem('taskData', JSON.stringify(taskData));
            localStorage.setItem('archivedTasks', JSON.stringify(archivedTasks));
            localStorage.setItem('settings', JSON.stringify(settings));
            updateSyncStatus('synced');
            return true;
        }
        updateSyncStatus('synced');
        return false;
    } catch (error) {
        updateSyncStatus('error');
        console.error('Firestore load error:', error);
        return false;
    }
}

// Log time entry to Firestore for long-term tracking
async function logTimeToFirestore(taskTitle, projectName, estimatedMinutes, actualMinutes) {
    if (!window.firestore) {
        console.log('Firestore not ready for time logging');
        return;
    }

    try {
        await window.firestore.logTimeEntry(taskTitle, projectName, estimatedMinutes, actualMinutes);
    } catch (error) {
        console.error('Failed to log time to Firestore:', error);
    }
}

// Update sync status indicator
function updateSyncStatus(status) {
    const indicator = document.getElementById('syncStatus');
    if (!indicator) return;

    indicator.className = 'sync-status ' + status;
    switch(status) {
        case 'syncing':
            indicator.innerHTML = '<span class="sync-icon">&#8635;</span> Syncing...';
            break;
        case 'synced':
            indicator.innerHTML = '<span class="sync-icon">&#10003;</span> Synced';
            break;
        case 'error':
            indicator.innerHTML = '<span class="sync-icon">&#10007;</span> Sync error';
            break;
        default:
            indicator.innerHTML = '<span class="sync-icon">&#9679;</span> Offline';
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

// Daily Digest Functions
function getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return formatDate(tomorrow);
}

function getAllTasks() {
    const allTasks = [];
    
    // Get all tasks from both sections
    ['today', 'longterm'].forEach(section => {
        taskData[section].forEach((group, groupIndex) => {
            group.tasks.forEach((task, taskIndex) => {
                allTasks.push({
                    ...task,
                    section,
                    groupName: group.groupName,
                    groupIndex,
                    taskIndex
                });
            });
        });
    });
    
    return allTasks;
}

function generateDailyDigest() {
    const tomorrow = getTomorrowDate();
    const today = getTodayDate();
    const allTasks = getAllTasks();
    
    // Filter out completed tasks
    const activeTasks = allTasks.filter(task => !task.completed);
    
    // Tasks due tomorrow
    const dueTomorrow = activeTasks.filter(task => task.dueDate === tomorrow);
    
    // Overdue tasks (due date is before today)
    const overdue = activeTasks.filter(task => {
        if (!task.dueDate) return false;
        return task.dueDate < today;
    });
    
    // Tasks that need attention (in-progress, high emotional weight, or urgent tags)
    const needsAttention = activeTasks.filter(task => {
        if (task.dueDate === tomorrow || (task.dueDate && task.dueDate < today)) {
            return false; // Already in other categories
        }
        return task.status === 'in-progress' || 
               task.emotionalWeight === 'heavy' ||
               (task.tags && task.tags.includes('urgent'));
    });
    
    // Rest of tasks (not in any of the above categories)
    const restOfTasks = activeTasks.filter(task => {
        const isDueTomorrow = task.dueDate === tomorrow;
        const isOverdue = task.dueDate && task.dueDate < today;
        const needsAttn = task.status === 'in-progress' || 
                         task.emotionalWeight === 'heavy' ||
                         (task.tags && task.tags.includes('urgent'));
        return !isDueTomorrow && !isOverdue && !needsAttn;
    });
    
    // Group rest of tasks by section
    const restBySection = {
        today: restOfTasks.filter(t => t.section === 'today'),
        longterm: restOfTasks.filter(t => t.section === 'longterm')
    };
    
    return {
        dueTomorrow,
        overdue,
        needsAttention,
        restBySection,
        summary: {
            totalActive: activeTasks.length,
            dueTomorrowCount: dueTomorrow.length,
            overdueCount: overdue.length,
            needsAttentionCount: needsAttention.length,
            restCount: restOfTasks.length
        }
    };
}

function renderDigestContent(digest) {
    const content = document.getElementById('dailyDigestContent');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    
    let html = `
        <div style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%); border-radius: 8px; color: white;">
            <h2 style="margin: 0 0 8px 0; font-size: 20px;">📋 Your Daily Digest</h2>
            <p style="margin: 0; opacity: 0.9; font-size: 14px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
    `;
    
    // Overdue tasks (highest priority)
    if (digest.overdue.length > 0) {
        html += `
            <div class="digest-section" style="border-left-color: #DC2626;">
                <div class="digest-section-title">
                    <span>🚨 Overdue (${digest.overdue.length})</span>
                </div>
                <ul class="digest-task-list">
                    ${digest.overdue.map(task => `
                        <li class="digest-task-item" onclick="editTask('${task.section}', ${task.groupIndex}, ${task.taskIndex}); closeDailyDigest();">
                            <div class="digest-task-title">${escapeHtml(task.title)}</div>
                            <div class="digest-task-meta">
                                <span>📁 ${escapeHtml(task.groupName)}</span>
                                ${task.dueDate ? `<span>📅 Due: ${task.dueDate}</span>` : ''}
                                ${task.estimatedMinutes ? `<span>⏱️ ${task.estimatedMinutes} min</span>` : ''}
                                ${task.tags && task.tags.length > 0 ? `<span>🏷️ ${task.tags.map(t => escapeHtml(t)).join(', ')}</span>` : ''}
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    // Tasks due tomorrow
    if (digest.dueTomorrow.length > 0) {
        html += `
            <div class="digest-section" style="border-left-color: #F59E0B;">
                <div class="digest-section-title">
                    <span>📅 Due Tomorrow - ${tomorrowFormatted} (${digest.dueTomorrow.length})</span>
                </div>
                <ul class="digest-task-list">
                    ${digest.dueTomorrow.map(task => `
                        <li class="digest-task-item" onclick="editTask('${task.section}', ${task.groupIndex}, ${task.taskIndex}); closeDailyDigest();">
                            <div class="digest-task-title">${escapeHtml(task.title)}</div>
                            <div class="digest-task-meta">
                                <span>📁 ${escapeHtml(task.groupName)}</span>
                                ${task.estimatedMinutes ? `<span>⏱️ ${task.estimatedMinutes} min</span>` : ''}
                                ${task.emotionalWeight ? `<span>${task.emotionalWeight === 'light' ? '💨' : task.emotionalWeight === 'moderate' ? '⚖️' : '🎯'} ${task.emotionalWeight}</span>` : ''}
                                ${task.tags && task.tags.length > 0 ? `<span>🏷️ ${task.tags.map(t => escapeHtml(t)).join(', ')}</span>` : ''}
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    // Tasks needing attention
    if (digest.needsAttention.length > 0) {
        html += `
            <div class="digest-section" style="border-left-color: #EA580C;">
                <div class="digest-section-title">
                    <span>⚡ Needs Attention (${digest.needsAttention.length})</span>
                </div>
                <ul class="digest-task-list">
                    ${digest.needsAttention.map(task => `
                        <li class="digest-task-item" onclick="editTask('${task.section}', ${task.groupIndex}, ${task.taskIndex}); closeDailyDigest();">
                            <div class="digest-task-title">${escapeHtml(task.title)}</div>
                            <div class="digest-task-meta">
                                <span>📁 ${escapeHtml(task.groupName)}</span>
                                ${task.status === 'in-progress' ? '<span>🔵 In Progress</span>' : ''}
                                ${task.emotionalWeight === 'heavy' ? '<span>🎯 Heavy</span>' : ''}
                                ${task.tags && task.tags.includes('urgent') ? '<span>🚨 Urgent</span>' : ''}
                                ${task.estimatedMinutes ? `<span>⏱️ ${task.estimatedMinutes} min</span>` : ''}
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    // Rest of tasks summary
    if (digest.restBySection.today.length > 0 || digest.restBySection.longterm.length > 0) {
        html += `
            <div class="digest-section" style="border-left-color: #D4C9BA;">
                <div class="digest-section-title">
                    <span>📝 Rest of Your Tasks (${digest.summary.restCount})</span>
                </div>
                ${digest.restBySection.today.length > 0 ? `
                    <div style="margin-bottom: 12px;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">⚡ Today (${digest.restBySection.today.length})</div>
                        <div class="digest-summary">
                            ${digest.restBySection.today.slice(0, 5).map(t => escapeHtml(t.title)).join(' • ')}
                            ${digest.restBySection.today.length > 5 ? ` • ...and ${digest.restBySection.today.length - 5} more` : ''}
                        </div>
                    </div>
                ` : ''}
                ${digest.restBySection.longterm.length > 0 ? `
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">📅 Long-term (${digest.restBySection.longterm.length})</div>
                        <div class="digest-summary">
                            ${digest.restBySection.longterm.slice(0, 5).map(t => escapeHtml(t.title)).join(' • ')}
                            ${digest.restBySection.longterm.length > 5 ? ` • ...and ${digest.restBySection.longterm.length - 5} more` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // Empty state
    if (digest.overdue.length === 0 && digest.dueTomorrow.length === 0 && 
        digest.needsAttention.length === 0 && digest.summary.restCount === 0) {
        html += `
            <div class="digest-empty">
                <p>🎉 You're all caught up! No active tasks at the moment.</p>
            </div>
        `;
    }
    
    // Summary stats
    html += `
        <div style="margin-top: 20px; padding: 16px; background: var(--accent-subtle); border-radius: 8px; text-align: center;">
            <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
                <div>
                    <div style="font-size: 24px; font-weight: 700; color: var(--accent-primary);">${digest.summary.totalActive}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Total Active</div>
                </div>
                ${digest.summary.overdueCount > 0 ? `
                    <div>
                        <div style="font-size: 24px; font-weight: 700; color: #DC2626;">${digest.summary.overdueCount}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Overdue</div>
                    </div>
                ` : ''}
                ${digest.summary.dueTomorrowCount > 0 ? `
                    <div>
                        <div style="font-size: 24px; font-weight: 700; color: #F59E0B;">${digest.summary.dueTomorrowCount}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Due Tomorrow</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    content.innerHTML = html;
}

window.showDailyDigest = function() {
    const digest = generateDailyDigest();
    renderDigestContent(digest);
    const modal = document.getElementById('dailyDigestModal');
    modal.classList.add('active');
    
    // Add escape key handler
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeDailyDigest();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

window.closeDailyDigest = function() {
    document.getElementById('dailyDigestModal').classList.remove('active');
}

// Initialize on load
init();
