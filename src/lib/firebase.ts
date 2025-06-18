import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (getApps().length === 0 && firebaseConfig.apiKey !== "YOUR_API_KEY") {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    // Set to null or throw an error, depending on how you want to handle init failure
    // For now, components trying to use auth/db will get undefined if init fails.
  }
} else if (getApps().length > 0) {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} else {
    console.warn("Firebase not initialized due to missing configuration.");
}

export { app, auth, db };
