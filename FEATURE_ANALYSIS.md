# Feature Analysis: Old App vs QuickTasks

This document analyzes features from the old task management app and evaluates which ones would benefit QuickTasks.

## Current QuickTasks Features

✅ **Already Implemented:**
- Basic task creation with projects/groups
- Task completion tracking with checkboxes
- Subtasks with hierarchical display
- Task editing modal (can edit title and subtasks)
- AI-powered task breakdown (ADHD-friendly, fuzzy, simple)
- AI task rephrasing for actionable language
- Multi-provider AI support (OpenAI, Gemini, Groq, Anthropic)
- Two-section organization (Today vs Long-term)
- Move tasks between sections
- Statistics panel
- Settings panel with dark mode
- API key management
- Calendar widget
- TSP resource links
- Progress indicators
- Local storage persistence

---

## Feature Recommendations by Priority

### 🟢 HIGH PRIORITY - Should Implement Soon

These features align perfectly with QuickTasks' ADHD-friendly mission and fill critical gaps:

#### 1. **Time Estimation & Tracking** (from #2, #26)
- **Why:** Critical for ADHD time blindness
- **Implementation:** Add `estimatedMinutes` and `actualMinutes` fields to tasks
- **UI:** Show estimates in task display, prompt for actual time on completion
- **Value:** Helps users learn realistic time estimation

#### 2. **Energy Level Metadata** (from #2)
- **Why:** Already started in AI breakdown, should be first-class feature
- **Implementation:** Add `energyRequired` field (low/medium/high)
- **UI:** Visual indicators (🟢🟡🔴) next to tasks
- **Value:** Match tasks to current energy state

#### 3. **Brain Dump Feature** (from #8)
- **Why:** Core ADHD need - capture thoughts without judgment
- **Implementation:** Quick capture area with prompts, converts to tasks later
- **UI:** Floating quick-add button, brain dump panel
- **Value:** Reduces anxiety about forgetting things

#### 4. **What Now? Wizard** (from #6)
- **Why:** Decision paralysis is major ADHD challenge
- **Implementation:** Ask about available time/energy, recommend matching task
- **UI:** Modal wizard with step-by-step questions
- **Value:** Removes decision-making burden

#### 5. **Tags System** (from #2, #14)
- **Why:** Flexible organization beyond just projects
- **Implementation:** Add `tags` array to tasks, tag filtering
- **UI:** Tag badges, tag picker in edit modal
- **Value:** Multiple ways to organize/find tasks

#### 6. **Task Dependencies** (from #1, #24)
- **Why:** Useful for breaking down overwhelming projects
- **Implementation:** Add `dependsOn` field with task IDs
- **UI:** Visual indicators, can't complete until dependencies done
- **Value:** Forces proper sequencing of work

#### 7. **Due Dates with Smart Parsing** (from #1, #2)
- **Why:** Time-based priorities essential
- **Implementation:** Add `dueDate` field, parse "tomorrow", "next Friday"
- **UI:** Date picker, calendar integration
- **Value:** Better deadline management

#### 8. **Emotional Weight** (from #2)
- **Why:** Already in fuzzy breakdown AI, should be first-class
- **Implementation:** Add `emotionalWeight` field (light/moderate/heavy)
- **UI:** Visual indicators (emojis or colors)
- **Value:** Plan around mental/emotional capacity

---

### 🟡 MEDIUM PRIORITY - Consider for Future

These features are valuable but less critical for QuickTasks' core use case:

#### 9. **Weekly Review System** (from #10)
- **Why:** Good for accountability and reflection
- **Implementation:** Guided weekly review wizard, journal entries
- **UI:** Review panel with prompts
- **Value:** Learning and improvement

#### 10. **Recurring Tasks** (from #22)
- **Why:** Useful for regular obligations (meds, bills, etc.)
- **Implementation:** Add recurring pattern definition, auto-generation
- **UI:** Recurring task creator, pattern display
- **Value:** Reduces mental load for routine tasks

#### 11. **Time Blocking View** (from #4)
- **Why:** Visual scheduling helpful for some ADHD users
- **Implementation:** Daily calendar view with drag-and-drop
- **UI:** Grid layout with time slots
- **Value:** Visual time planning

#### 12. **Priority Scoring** (from #2)
- **Why:** Objective prioritization helpful
- **Implementation:** Composite score from urgency + importance + other factors
- **UI:** Priority badge/number on tasks
- **Value:** Clear ranking of what to do first

#### 13. **Bulk Operations** (from #15)
- **Why:** Efficient for managing many tasks
- **Implementation:** Multi-select checkboxes, bulk action menu
- **UI:** Selection mode, action buttons
- **Value:** Speed and efficiency

#### 14. **Follow-up Task Prompts** (from #25)
- **Why:** Catches incomplete work
- **Implementation:** On task completion, prompt "Any follow-up needed?"
- **UI:** Modal after marking complete
- **Value:** Prevents tasks from truly being "done" when they aren't

#### 15. **Hyperfocus Management** (from #11)
- **Why:** Prevent losing hours to hyperfocus
- **Implementation:** Timer alerts, break reminders
- **UI:** Focus mode with periodic check-ins
- **Value:** Healthier work patterns

---

### 🔵 LOW PRIORITY - Nice to Have

These features are less aligned with QuickTasks' focused mission:

#### 16. **Project Phases** (from #13)
- **Why:** Adds complexity, current project grouping sufficient
- **Consider:** Only if users frequently request it

#### 17. **Calendar View** (from #29)
- **Why:** Already have calendar widget, full calendar less critical
- **Consider:** If due dates are implemented

#### 18. **Command Palette** (from #28)
- **Why:** Power user feature, may be overkill for this app
- **Consider:** If keyboard shortcuts become important

#### 19. **Analytics Dashboard** (from #16, #17)
- **Why:** Interesting but not core to task management
- **Consider:** If users want to track productivity patterns

#### 20. **Backward Planning** (from #5)
- **Why:** Specialized planning technique
- **Consider:** Maybe as AI wizard option

---

### ⚪ NOT RECOMMENDED

These features don't fit QuickTasks' design philosophy:

#### ❌ **Cloud Sync** (from #18)
- **Why:** Adds complexity, auth, costs. LocalStorage is simpler.
- **Alternative:** Export/import for backups

#### ❌ **Multiple Categories** (from #14)
- **Why:** Current two-section (Today/Long-term) is intentionally simple
- **Alternative:** Use tags if more organization needed

#### ❌ **Deleted Tasks Management** (from #21)
- **Why:** Adds UI complexity, local storage limitations
- **Alternative:** Confirm before delete

#### ❌ **Duplicate Cleanup** (from #20)
- **Why:** Edge case, not worth the complexity
- **Alternative:** Manual prevention

#### ❌ **Kanban Board** (from #5)
- **Why:** Different paradigm than current design
- **Alternative:** Current Today/Long-term split works well

---

## Recommended Implementation Roadmap

### Phase 1: Core Enhancements (Next 2-3 weeks)
1. ✅ Task edit modal with subtasks (DONE)
2. ✅ AI improvements (DONE)
3. ⏳ Energy level field + UI
4. ⏳ Time estimation + tracking
5. ⏳ Tags system
6. ⏳ Brain dump panel

### Phase 2: Decision Support (Month 2)
7. What Now? wizard
8. Emotional weight indicators
9. Due dates with parsing
10. Task dependencies

### Phase 3: Long-term Features (Month 3+)
11. Weekly review system
12. Recurring tasks
13. Follow-up prompts
14. Hyperfocus management
15. Time blocking view (if requested)

---

## Key Principles for QuickTasks

Based on the current design, maintain these principles when adding features:

1. **Simplicity First**: Don't add complexity that overwhelms ADHD users
2. **Visual Clarity**: Use color, icons, gradients to make information scannable
3. **Minimal Clicks**: Reduce steps to complete actions
4. **Smart Defaults**: Make good decisions for users
5. **AI Integration**: Use AI to reduce cognitive load
6. **Mobile-Friendly**: Keep responsive design
7. **No Auth Required**: Keep it simple with local storage
8. **Beautiful UI**: Maintain the gorgeous gradient aesthetic

---

## Features to Avoid

- Complex project management (Gantt charts, dependencies graphs)
- Heavy analytics/reporting (overwhelming for ADHD)
- Social/collaboration features (different use case)
- Multiple workspaces/accounts (too complex)
- Strict GTD/productivity methodologies (rigid systems don't work for ADHD)

---

## Next Steps

1. Review this analysis with the user
2. Prioritize top 3-5 features to implement next
3. Create detailed specs for chosen features
4. Implement one feature at a time
5. Get user feedback before moving to next feature

---

*This analysis preserves the feature list from the old app while providing guidance on what fits QuickTasks' mission of being a beautiful, ADHD-friendly task manager that doesn't overwhelm users.*
