// Browser-side Firebase config for the isolated MySocial2 staging project.
// This is public client configuration, never a service-account credential.
export const firebaseConfig = {
  apiKey: "AIzaSyDAC_EDYH6k7y0NW6aXE4CD79tzceiDyEc",
  authDomain: "mysocial2-staging.firebaseapp.com",
  projectId: "mysocial2-staging",
  storageBucket: "mysocial2-staging.firebasestorage.app",
  messagingSenderId: "1006772588130",
  appId: "1:1006772588130:web:ef4f27b1ccf528b9724b3b",
  measurementId: "G-1NWJ3JDRZC",
  vapidKey: "" // Add a staging-only Web Push VAPID key if push is enabled.
};
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain &&
  firebaseConfig.projectId && firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);
