
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, setLogLevel, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { 
    getAuth, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    getRedirectResult, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithRedirect,
    type Auth 
} from 'firebase/auth';

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
let app: FirebaseApp;
if (typeof window !== 'undefined') {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
} else {
    // For server-side rendering, we might not need to initialize the app
    // or we can use a mock. However, for auth, client-side init is crucial.
    // This block is mainly a safeguard.
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
}


const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
});
const storage = getStorage(app);

// Suppress non-critical Firestore connection warnings.
// The app is designed to work offline, so these warnings are expected and normal.
if (typeof window !== 'undefined') {
    setLogLevel('error');
}


// Use a function to get auth instance to ensure it's client-side
let authInstance: Auth | null = null;
const getFirebaseAuth = (): Auth => {
    if (typeof window === 'undefined') {
        // Return a mock or minimal auth object on the server
        return {} as Auth;
    }
    if (!authInstance) {
        authInstance = getAuth(app);
    }
    return authInstance;
}

const getGoogleProvider = (): GoogleAuthProvider => {
    const provider = new GoogleAuthProvider();
    // No advanced scopes are needed here since we use App Password for sending emails.
    // The sign-in is purely for authentication.
    return provider;
};

export { 
    app, 
    db, 
    storage, 
    getFirebaseAuth, 
    getGoogleProvider, 
    onAuthStateChanged, 
    getRedirectResult,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithRedirect
};


