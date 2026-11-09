// Firebase Web client configuration for MySocial2.
// This is browser-side configuration, not a service-account credential.
// Never add service-account JSON, private keys, or Admin SDK credentials here.
export const firebaseConfig = {
  apiKey: "AIzaSyAIjCW1UP3yDTap6VTDzNP62Ot0BHNm_WI",
  authDomain: "mysocial2-5c3c5.firebaseapp.com",
  projectId: "mysocial2-5c3c5",
  storageBucket: "mysocial2-5c3c5.firebasestorage.app",
  messagingSenderId: "120207339127",
  appId: "1:120207339127:web:4fd5c5e5ffb57348b0a072",
  vapidKey: "" // Add the Web Push certificate key from Firebase Console
};
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain &&
  firebaseConfig.projectId && firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);
