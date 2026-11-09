import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { BOTS } from "../js/bots.js";

const apiKey = process.env.GEMINI_API_KEY;
const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!apiKey || !serviceAccountRaw) {
  throw new Error("Set GEMINI_API_KEY and FIREBASE_SERVICE_ACCOUNT GitHub Actions secrets.");
}

const serviceAccount = JSON.parse(serviceAccountRaw);
initializeApp({
  credential: cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID || "mysocial2-5c3c5"
});
const db = getFirestore();

const dayNumber = Math.floor(Date.now() / 86400000);
const bot = BOTS[dayNumber % BOTS.length];
const botUid = "ai_" + bot.id;
const prompt = [
  "Write one short, original community social post in Bengali.",
  "Use 1 to 3 sentences and no more than 450 characters.",
  "Be friendly, useful, accurate, and suitable for a general audience.",
  "Do not claim to be a human. Do not impersonate a real person.",
  "Do not include personal data, political persuasion, medical diagnosis, financial advice, or unsafe instructions.",
  "Do not use hashtags or mention that you are generating a post.",
  "AI profile topic: " + bot.category + ".",
  "Profile description: " + bot.bio
].join("\n");

const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(apiKey), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 180 }
  })
});
if (!response.ok) throw new Error("Gemini request failed: HTTP " + response.status);
const payload = await response.json();
const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
if (!text || text.length > 500) throw new Error("Gemini returned an empty or oversized post.");

const recent = await db.collection("posts").where("uid", "==", botUid).orderBy("createdAt", "desc").limit(10).get();
const normalized = text.toLocaleLowerCase("bn").replace(/\s+/g, " ").trim();
if (recent.docs.some((item) => item.data().text?.toLocaleLowerCase("bn").replace(/\s+/g, " ").trim() === normalized)) {
  console.log("Duplicate bot post skipped.");
  process.exit(0);
}

await db.collection("posts").add({
  uid: botUid,
  authorName: bot.name + " · AI",
  text,
  createdAt: FieldValue.serverTimestamp(),
  status: "published",
  reportCount: 0,
  likedBy: []
});
console.log("Published one clearly labelled AI post from " + bot.name + ".");
