
// This file mimics the global __app_id, __firebase_config, __initial_auth_token
// from the user's original environment.
// In a typical Next.js app, these would be loaded from environment variables.

export const appId: string = (typeof (globalThis as any).__app_id !== 'undefined' ? (globalThis as any).__app_id : undefined) ?? process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? 'teen-patti-chip-manager';

let config;
try {
    config = typeof (globalThis as any).__firebase_config !== 'undefined' ? JSON.parse((globalThis as any).__firebase_config) : undefined;
} catch (e) {
    console.warn("Could not parse __firebase_config");
    config = undefined;
}

// Provide a default fallback if no config is found.
// Replace with your actual Firebase config.
export const firebaseConfig = config ?? {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBFEzWQmzolSNCfP1c1hxE6dral1QqXQ1E",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "teen-patti-chip-manager.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "teen-patti-chip-manager",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "teen-patti-chip-manager.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1013599472463",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID_CONFIG || "1:1013599472463:web:5116b7d3235350224a933a",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "YOUR_MEASUREMENT_ID"
};

export const initialAuthToken: string | null = (typeof (globalThis as any).__initial_auth_token !== 'undefined' ? (globalThis as any).__initial_auth_token : null) ?? process.env.INITIAL_AUTH_TOKEN ?? null;

// Validate firebaseConfig
if (firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.projectId === "YOUR_PROJECT_ID") {
  console.warn(
    "Firebase configuration is using placeholder values. " +
    "Please update src/lib/firebaseConfig.ts with your actual Firebase project configuration, " +
    "or set the corresponding NEXT_PUBLIC_FIREBASE_ environment variables."
  );
}
