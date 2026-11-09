importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAIjCW1UP3yDTap6VTDzNP62Ot0BHNm_WI",
  authDomain: "mysocial2-5c3c5.firebaseapp.com",
  projectId: "mysocial2-5c3c5",
  storageBucket: "mysocial2-5c3c5.firebasestorage.app",
  messagingSenderId: "120207339127",
  appId: "1:120207339127:web:4fd5c5e5ffb57348b0a072"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "MySocial2";
  const options = {
    body: payload.notification?.body || "আপনার নতুন নোটিফিকেশন এসেছে।",
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
