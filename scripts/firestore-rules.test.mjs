import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, writeBatch, addDoc, collection, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";

const projectId = "demo-mysocial2";
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const env = await initializeTestEnvironment({ projectId, firestore: { rules } });

try {
  await env.clearFirestore();
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const charlie = env.authenticatedContext("charlie").firestore();

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
  await assertSucceeds(updateDoc(doc(bob, "posts", "sample-post"), { likedBy: arrayUnion("bob") }));
  await assertFails(updateDoc(doc(charlie, "posts", "sample-post"), { likedBy: arrayRemove("bob") }));

  console.log("Firestore security rules tests passed.");
} finally {
  await env.cleanup();
}
