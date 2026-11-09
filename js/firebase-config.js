// Firebase Web configuration only. Never put service-account keys or private credentials here.
// Replace these placeholders with the config from Firebase Console > Project settings > Your apps.
// Project selected for MySocial2: mysocial2-5c3c5
export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_WEB_API_KEY",
  authDomain: "mysocial2-5c3c5.firebaseapp.com",
  projectId: "mysocial2-5c3c5",
  storageBucket: "mysocial2-5c3c5.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_") &&
  firebaseConfig.messagingSenderId && !firebaseConfig.messagingSenderId.startsWith("YOUR_") &&
  firebaseConfig.appId && !firebaseConfig.appId.startsWith("YOUR_")
);
