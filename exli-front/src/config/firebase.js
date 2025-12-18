import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Backend URL
export const CLOUD_RUN_URL = import.meta.env.VITE_CLOUD_RUN_URL;

// --- NEW: Global Logger ---
export const logUserAction = async (userId, actionType, description, metadata = {}) => {
  if (!userId) return;
  try {
    await addDoc(collection(db, 'users', userId, 'history'), {
      actionType, // e.g., "EXPENSE_ADDED", "CATEGORY_CHANGE"
      description, // Human readable string
      metadata, // Any extra data (docId, amount, etc.)
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};