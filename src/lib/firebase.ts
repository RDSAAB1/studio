
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
    getAdditionalUserInfo,
    type Auth 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCxqbx1KpLRo7GG0BsjQC3A6ANIS_1x_KU",
  authDomain: "bizsuite-dataflow.firebaseapp.com",
  projectId: "bizsuite-dataflow",
  storageBucket: "bizsuite-dataflow.appspot.com",
  messagingSenderId: "1083654429292",
  appId: "1:1083654429292:web:735c2b52865c1f394a5e0f"
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


const firestoreDB = initializeFirestore(app, {
    localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
});
const storage = getStorage(app);

// Suppress Firestore connectivity logs in production/offline.
// App uses IndexedDB-first, so connectivity warnings are noise.
if (typeof window !== 'undefined') {
    setLogLevel('silent');
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
    firestoreDB, // Changed export name
    storage, 
    getFirebaseAuth, 
    getGoogleProvider, 
    onAuthStateChanged, 
    getRedirectResult,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithRedirect,
    getAdditionalUserInfo
};
