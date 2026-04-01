// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, setLogLevel, type Firestore } from 'firebase/firestore';
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

// Initialize Firebase app (singleton)
let app: FirebaseApp;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

// No persistent cache — persistentLocalCache was causing setDoc to hang on company creation.
const firestoreDB: Firestore = initializeFirestore(app, {});
const storage = getStorage(app);

if (typeof window !== 'undefined') {
    setLogLevel('silent');
}

// Auth singleton.
// NOTE: Electron network issues (auth/network-request-failed) are handled at the
// Electron main process level. In electron/main.js, we inject a global window.fetch
// override into the renderer's main world that transparently proxies all
// identitytoolkit.googleapis.com calls through /api/firebase-auth-proxy (which 
// runs in Node.js and has full internet access). This means the SDK's own fetch
// calls are intercepted automatically — no Firebase SDK internals needed here.
let authInstance: Auth | null = null;
const getFirebaseAuth = (): Auth => {
    if (typeof window === 'undefined') return {} as Auth;
    if (!authInstance) authInstance = getAuth(app);
    return authInstance;
};

const getGoogleProvider = (): GoogleAuthProvider => {
    const provider = new GoogleAuthProvider();
    return provider;
};

export { 
    app, 
    firestoreDB,
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
