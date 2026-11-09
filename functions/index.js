const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

async function createAndSend(recipientUid, notificationId, title, body, type) {
  if (!recipientUid) return;
  const db = getFirestore();
  const notificationRef = db.collection("notifications").doc(notificationId);
  let shouldSend = false;

  await db.runTransaction(async (tx) => {
    shouldSend = false;
    const existing = await tx.get(notificationRef);
    if (!existing.exists) {
      tx.create(notificationRef, {
        recipientUid, title, body, type, read: false,
        pushSent: false, createdAt: FieldValue.serverTimestamp()
      });
      shouldSend = true;
    } else if (existing.data().pushSent !== true) {
      shouldSend = true;
    }
  });

  if (!shouldSend) return;
  const tokenSnapshot = await db.collection("users").doc(recipientUid).collection("fcmTokens").get();
  const tokens = tokenSnapshot.docs.map((item) => item.data().token).filter(Boolean);
  if (tokens.length) {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { type, notificationId, url: "./" }
    });
  }
  await notificationRef.update({ pushSent: true, pushSentAt: FieldValue.serverTimestamp() });
}

exports.friendRequestCreated = onDocumentCreated("friendRequests/{requestId}", async (event) => {
  const request = event.data?.data();
  if (!request || request.status !== "pending") return;
  await createAndSend(
    request.recipientUid,
    "friend_request_" + event.params.requestId,
    "নতুন Friend Request",
    (request.senderName || "একজন সদস্য") + " আপনাকে Friend Request পাঠিয়েছেন।",
    "friend_request"
  );
});

exports.friendRequestAccepted = onDocumentUpdated("friendRequests/{requestId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === "accepted" || after.status !== "accepted") return;
  await createAndSend(
    after.senderUid,
    "friend_accepted_" + event.params.requestId,
    "Friend Request গৃহীত",
    (after.recipientName || "আপনার বন্ধু") + " আপনার Friend Request গ্রহণ করেছেন।",
    "friend_accepted"
  );
});
