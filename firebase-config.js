// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD-gfaA6kvJiAeN9mJ3lLKkN6DT4YQfMho",
  authDomain: "quick-task-dashboard.firebaseapp.com",
  projectId: "quick-task-dashboard",
  storageBucket: "quick-task-dashboard.firebasestorage.app",
  messagingSenderId: "774476454126",
  appId: "1:774476454126:web:1b3f0adb518d1418517bff",
  measurementId: "G-ZZ3B4H4TX1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, analytics };
