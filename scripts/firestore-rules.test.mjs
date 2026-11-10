import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, writeBatch, addDoc, collection, arrayUnion, arrayRemove, serverTimestamp, Timestamp } from "firebase/firestore";

const projectId = "demo-mysocial2";
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const env = await initializeTestEnvironment({ projectId, firestore: { rules } });

try {
  await env.clearFirestore();
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const charlie = env.authenticatedContext("charlie").firestore();

  await assertSucceeds(setDoc(doc(alice, "users", "alice"), {
    displayName: "Alice", email: "alice@example.com", createdAt: serverTimestamp(), bio: ""
  }));
  await assertSucceeds(updateDoc(doc(alice, "users", "alice"), {
    photoURL: "https://images.example.com/alice.jpg"
  }));
  await assertFails(updateDoc(doc(alice, "users", "alice"), {
    photoURL: "javascript:alert(1)"
  }));

  await assertSucceeds(setDoc(doc(alice, "publicProfiles", "alice"), {
    displayName: "Alice", createdAt: serverTimestamp(),
    photoURL: "https://images.example.com/alice.jpg"
  }));
  await assertFails(updateDoc(doc(alice, "publicProfiles", "alice"), {
    photoURL: "http://images.example.com/alice.jpg"
  }));
  await assertFails(updateDoc(doc(alice, "publicProfiles", "alice"), {
    photoURL: "javascript:alert(1)"
  }));
  await assertSucceeds(updateDoc(doc(alice, "publicProfiles", "alice"), {
    photoURL: ""
  }));
  await assertSucceeds(setDoc(doc(bob, "publicProfiles", "bob"), {
    displayName: "Bob", createdAt: serverTimestamp()
  }));
  await assertSucceeds(setDoc(doc(charlie, "publicProfiles", "charlie"), {
    displayName: "Charlie", createdAt: serverTimestamp()
  }));

  const declinedRequestId = "bob_charlie";
  await assertFails(setDoc(doc(bob, "friendRequests", declinedRequestId), {
    senderUid: "bob", senderName: "Alice", recipientUid: "charlie",
    recipientName: "Charlie", status: "pending", createdAt: serverTimestamp()
  }));
  await assertSucceeds(setDoc(doc(bob, "friendRequests", declinedRequestId), {
    senderUid: "bob", senderName: "Bob", recipientUid: "charlie",
    recipientName: "Charlie", status: "pending", createdAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(charlie, "friendRequests", declinedRequestId), {
    status: "declined"
  }));
  await assertSucceeds(updateDoc(doc(bob, "friendRequests", declinedRequestId), {
    senderUid: "bob", senderName: "Bob", recipientUid: "charlie",
    recipientName: "Charlie", status: "pending", createdAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(charlie, "friendRequests", declinedRequestId), {
    status: "declined"
  }));
  await assertSucceeds(updateDoc(doc(charlie, "friendRequests", declinedRequestId), {
    senderUid: "charlie", senderName: "Charlie", recipientUid: "bob",
    recipientName: "Bob", status: "pending", createdAt: serverTimestamp()
  }));

  const requestId = "alice_bob";
  await assertSucceeds(setDoc(doc(alice, "friendRequests", requestId), {
    senderUid: "alice", senderName: "Alice", recipientUid: "bob",
    recipientName: "Bob", status: "pending", createdAt: serverTimestamp()
  }));

  const acceptBatch = writeBatch(bob);
  acceptBatch.update(doc(bob, "friendRequests", requestId), { status: "accepted" });
  acceptBatch.set(doc(bob, "friendships", requestId), {
    senderUid: "alice", recipientUid: "bob", senderName: "Alice",
    recipientName: "Bob", members: ["alice", "bob"], createdAt: serverTimestamp()
  });
  await assertSucceeds(acceptBatch.commit());

  await assertSucceeds(setDoc(doc(alice, "chats", requestId), {
    participants: ["alice", "bob"], updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(alice, "chats", requestId), { updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(alice, "chats", requestId), { lastMessage: "Hello", updatedAt: serverTimestamp() }));
  await assertSucceeds(addDoc(collection(alice, "chats", requestId, "messages"), {
    senderUid: "alice", text: "Hello", createdAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(charlie, "chats", "alice_charlie"), {
    participants: ["alice", "charlie"], updatedAt: serverTimestamp()
  }));
  await assertFails(addDoc(collection(charlie, "chats", requestId, "messages"), {
    senderUid: "charlie", text: "Not allowed", createdAt: serverTimestamp()
  }));

  const postRef = doc(alice, "posts", "sample-post");
  await assertSucceeds(setDoc(postRef, {
    uid: "alice", authorName: "Alice", text: "A public post",
    createdAt: serverTimestamp(), status: "published", reportCount: 0, likedBy: []
  }));
  await assertFails(setDoc(doc(alice, "posts", "spoofed-author-post"), {
    uid: "alice", authorName: "Bob", text: "Spoofed author",
    createdAt: serverTimestamp(), status: "published", reportCount: 0, likedBy: []
  }));
  await assertSucceeds(addDoc(collection(alice, "posts", "sample-post", "comments"), {
    uid: "alice", authorName: "Alice", text: "A comment", createdAt: serverTimestamp()
  }));
  await assertFails(addDoc(collection(alice, "posts", "sample-post", "comments"), {
    uid: "alice", authorName: "Bob", text: "Spoofed comment", createdAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(bob, "posts", "sample-post"), { likedBy: arrayUnion("bob") }));
  await assertFails(updateDoc(doc(charlie, "posts", "sample-post"), { likedBy: arrayRemove("bob") }));

  await assertSucceeds(setDoc(doc(alice, "stories", "alice-story"), {
    uid: "alice", authorName: "Alice", text: "A 24-hour story",
    createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 23 * 60 * 60 * 1000)
  }));
  await assertFails(setDoc(doc(alice, "stories", "spoofed-story"), {
    uid: "alice", authorName: "Bob", text: "Spoofed author",
    createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 23 * 60 * 60 * 1000)
  }));
  await assertFails(setDoc(doc(alice, "stories", "too-long-story"), {
    uid: "alice", authorName: "Alice", text: "Too long",
    createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 25 * 60 * 60 * 1000)
  }));

  await assertSucceeds(setDoc(doc(alice, "groups", "public-group"), {
    name: "Community", description: "A public group", createdBy: "alice",
    createdAt: serverTimestamp(), visibility: "public"
  }));
  await assertSucceeds(setDoc(doc(alice, "groups", "public-group", "members", "alice"), {
    uid: "alice", displayName: "Alice", joinedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(alice, "groups", "public-group", "members", "alice-spoof"), {
    uid: "alice", displayName: "Bob", joinedAt: serverTimestamp()
  }));
  await assertSucceeds(setDoc(doc(bob, "groups", "public-group", "members", "bob"), {
    uid: "bob", displayName: "Bob", joinedAt: serverTimestamp()
  }));

  await assertSucceeds(setDoc(doc(alice, "posts", "image-only-post"), {
    uid: "alice", authorName: "Alice", text: "", createdAt: serverTimestamp(),
    status: "published", reportCount: 0, likedBy: [],
    imageUrl: "https://images.example.com/photo.jpg"
  }));
  await assertFails(setDoc(doc(alice, "posts", "insecure-image-url"), {
    uid: "alice", authorName: "Alice", text: "", createdAt: serverTimestamp(),
    status: "published", reportCount: 0, likedBy: [],
    imageUrl: "http://images.example.com/photo.jpg"
  }));

  await assertSucceeds(setDoc(doc(bob, "users", "bob", "fcmTokens", "token-1"), {
    token: "valid-fcm-token", createdAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(charlie, "users", "bob", "fcmTokens", "token-2"), {
    token: "not-your-token", createdAt: serverTimestamp()
  }));

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "notifications", "bob-notice"), {
      recipientUid: "bob", title: "Test", body: "A test notification", read: false,
      createdAt: serverTimestamp()
    });
  });
  await assertSucceeds(getDoc(doc(bob, "notifications", "bob-notice")));
  await assertSucceeds(updateDoc(doc(bob, "notifications", "bob-notice"), { read: true }));
  await assertFails(getDoc(doc(charlie, "notifications", "bob-notice")));
  await assertFails(updateDoc(doc(charlie, "notifications", "bob-notice"), { read: true }));

  console.log("Firestore security rules tests passed.");
} finally {
  await env.cleanup();
}
