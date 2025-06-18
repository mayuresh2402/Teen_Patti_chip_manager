import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (getApps().length === 0) {
  // If no apps are initialized, always try to initialize.
  // The warning about placeholder keys is handled in firebaseConfig.ts.
  // If apiKey is a placeholder, initializeApp will still run.
  // This prevents auth from being undefined, addressing the immediate error.
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    // If initializeApp itself fails (e.g., due to a malformed config object),
    // auth and db might remain undefined. In this case, the error
    // in AuthContext.tsx ("Firebase auth is not initialized.") would still be relevant.
  }
} else {
  // App is already initialized, get the existing instance.
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
