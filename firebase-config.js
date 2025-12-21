// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwMnIWcaAVabpI_wE00hB1VvjFjpXTUsk",
  authDomain: "my-daily-dashboard.firebaseapp.com",
  projectId: "my-daily-dashboard",
  storageBucket: "my-daily-dashboard.firebasestorage.app",
  messagingSenderId: "708407777052",
  appId: "1:708407777052:web:90139e34421658e2a94cd9",
  measurementId: "G-179EC3TGEC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, analytics };
