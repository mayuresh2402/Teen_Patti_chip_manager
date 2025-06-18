// This file mimics the global __app_id, __firebase_config, __initial_auth_token
// from the user's original environment.
// In a typical Next.js app, these would be loaded from environment variables.

export const appId: string = (typeof (globalThis as any).__app_id !== 'undefined' ? (globalThis as any).__app_id : undefined) ?? process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? 'default-chipstack-app';

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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID_CONFIG || "YOUR_APP_ID",
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
