# QuickTasks - Premium Task Dashboard

A beautiful, feature-rich task management dashboard with cloud sync powered by Firebase Firestore.

## Features

### UI/UX
- **Premium Design**: Modern, polished interface with smooth animations
- **Dark Mode**: Toggle between light and dark themes
- **Progress Tracking**: Visual progress indicators for tasks and projects
- **Responsive**: Works beautifully on desktop and mobile devices
- **Custom Checkboxes**: Beautifully styled interactive checkboxes

### Functionality
- **Task Management**: Organize tasks into "Today" and "Long-term" sections
- **Task Groups**: Group related tasks into projects
- **Subtasks**: Break down complex tasks into smaller steps
- **Quick Add**: Rapidly add new tasks with keyboard shortcuts
- **Delete Tasks**: Remove completed or unnecessary tasks
- **Statistics**: Track completion rates and productivity metrics
- **Settings Panel**: Customize your experience

### Cloud Features
- **Firebase Sync**: All data synced to Firestore in real-time
- **Multi-Device**: Access your tasks from anywhere
- **Google Authentication**: Secure sign-in with your Google account
- **Real-time Updates**: Changes sync instantly across all devices
- **Offline Support**: Works offline with localStorage fallback

## Setup Instructions

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Enable **Google Authentication**:
   - Go to Authentication > Sign-in method
   - Enable Google provider
   - Add your domain to authorized domains

4. Create a **Firestore Database**:
   - Go to Firestore Database
   - Click "Create database"
   - Start in **production mode**
   - Choose your preferred location

5. Set up **Firestore Security Rules**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

6. Get your **Firebase Config**:
   - Go to Project Settings (gear icon)
   - Scroll down to "Your apps"
   - Click the web icon (</>) to add a web app
   - Copy the firebaseConfig object

### 2. Update the Code

Open `index.html` and find this section (around line 772):

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

Replace with your actual Firebase config values.

### 3. Deploy

You can deploy this in several ways:

#### Option A: Firebase Hosting (Recommended)
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init hosting

# Deploy
firebase deploy
```

#### Option B: Any Static Host
Upload `index.html` to:
- GitHub Pages
- Netlify
- Vercel
- Any web server

### 4. Access Control

The Firestore security rules ensure that:
- Users can only read/write their own data
- Authentication is required
- Each user's data is isolated

## Usage

### Basic Usage
1. Open the app in your browser
2. Click the user icon (👤) to sign in with Google
3. Start adding tasks using the quick-add boxes
4. Check off tasks as you complete them
5. View your progress with the circular indicators

### Keyboard Shortcuts
- `Cmd/Ctrl + K`: Focus on quick-add input
- `Escape`: Close panels
- `Enter`: Submit quick-add task

### Statistics
Click the 📊 icon to view:
- Completed tasks today
- Total tasks
- Completion rate
- Active projects

### Settings
Click the ⚙️ icon to:
- Toggle dark mode
- Show/hide completed tasks
- Clear all data (use with caution!)

### Task Organization
- **Today Section**: For urgent, immediate tasks
- **Long-term Section**: For ongoing projects and future tasks
- **Task Groups**: Organize related tasks together
- **Subtasks**: Break complex tasks into steps

## Data Storage

### Hybrid Approach
- **localStorage**: Always used for offline access and fast loading
- **Firestore**: Cloud sync when signed in, enabling multi-device access

### Data Structure
```javascript
{
  taskData: {
    today: [{ groupName: "...", tasks: [...] }],
    longterm: [{ groupName: "...", tasks: [...] }]
  },
  settings: {
    darkMode: false,
    showCompleted: true
  },
  lastUpdated: timestamp
}
```

## Troubleshooting

### Firebase Not Working
1. Check browser console for errors
2. Verify Firebase config is correct
3. Ensure authentication is enabled
4. Check Firestore security rules
5. Make sure your domain is authorized

### Sync Issues
- Check internet connection
- Sign out and sign in again
- Check browser console for errors
- Verify Firestore rules allow your user

### Can't Sign In
- Ensure Google auth is enabled in Firebase Console
- Check that your domain is in authorized domains
- Try a different browser
- Clear browser cache

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## Future Enhancements

Potential features to add:
- Due dates and reminders
- Priority levels
- Tags and filters
- Task search
- Drag-and-drop reordering
- Collaborative tasks
- Email notifications
- Calendar integration
- Export to CSV/JSON
- Task templates

## License

Free to use and modify as needed.

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify Firebase configuration
3. Review Firestore security rules
4. Test in incognito mode to rule out extensions

---

Built with ❤️ using vanilla JavaScript and Firebase
