importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging-compat.js");

// Staging-only Firebase project. Never use production credentials here.
firebase.initializeApp({
  apiKey: "AIzaSyDAC_EDYH6k7y0NW6aXE4CD79tzceiDyEc",
  authDomain: "mysocial2-staging.firebaseapp.com",
  projectId: "mysocial2-staging",
  storageBucket: "mysocial2-staging.firebasestorage.app",
  messagingSenderId: "1006772588130",
  appId: "1:1006772588130:web:ef4f27b1ccf528b9724b3b"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "MySocial2 Staging";
  const options = {
    body: payload.notification?.body || "আপনার নতুন স্টেজিং নোটিফিকেশন এসেছে।",
    icon: "./assets/icon.svg",
    data: { url: payload.data?.url || "./" }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "./";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ("focus" in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});
