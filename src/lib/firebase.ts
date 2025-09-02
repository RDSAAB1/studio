
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

// Use a function to get auth instance to ensure it's client-side
let auth: Auth;
const getFirebaseAuth = (): Auth => {
    if (typeof window === 'undefined') {
        // Return a mock or minimal auth object on the server
        return {} as Auth;
    }
    if (!auth) {
        auth = getAuth(app);
    }
    return auth;
}

const getGoogleProvider = (): GoogleAuthProvider => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/gmail.send');
    provider.setCustomParameters({
        access_type: 'offline', // Request a refresh token
        prompt: 'consent' // Force consent screen to get refresh token on every login for simplicity
    });
    return provider;
};

export { app, db, storage, getFirebaseAuth, getGoogleProvider };
