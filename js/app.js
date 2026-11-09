import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { BOTS } from "./bots.js";

const $ = (id) => document.getElementById(id);
const state = { mode: "login", user: null, db: null, auth: null, firebase: null, posts: [], lang: "bn", friendRequests: [], friends: [], chats: [], activeChatId: null, messageUnsubscribe: null, deferredInstall: null, adminReportsUnsubscribe: null, storiesUnsubscribe: null, groupsUnsubscribe: null, notificationUnsubscribe: null, groupMemberships: new Set() };
const copy = {
  bn: {welcome:"স্বাগতম",home:"হোম",stories:"স্টোরিজ",friends:"বন্ধু",messages:"মেসেজ",notifications:"নোটিফিকেশন",profile:"প্রোফাইল",sidebarNote:"বন্ধুদের সঙ্গে যুক্ত থাকুন, নিরাপদে শেয়ার করুন।",headline:"আপনার মানুষের সঙ্গে যুক্ত থাকুন",subheadline:"ভাবনা, গল্প ও মুহূর্ত শেয়ার করুন।",accountTitle:"শুরু করুন",login:"লগইন",register:"রেজিস্ট্রেশন",email:"ইমেইল",password:"পাসওয়ার্ড",fullName:"আপনার নাম",firebaseHint:"নিজের Firebase Web config যোগ করলে অ্যাকাউন্ট ও পোস্ট সংরক্ষিত হবে।",createPost:"নতুন পোস্ট",postPlaceholder:"আজ আপনার মনে কী আছে?",publish:"পোস্ট করুন",latestPosts:"সাম্প্রতিক পোস্ট",emptyFeed:"এখনো কোনো পোস্ট নেই",emptyFeedHint:"প্রথম পোস্টটি আপনিই করতে পারেন।",aiCorner:"AI কর্নার",botDisclosure:"এখানে দেখানো সহকারীরা AI; তারা বাস্তব মানুষ নয়।",safeSpace:"নিরাপদ কমিউনিটি",guideline1:"সম্মানজনক ভাষা ব্যবহার করুন",guideline2:"ব্যক্তিগত তথ্য প্রকাশ করবেন না",guideline3:"সমস্যাজনক পোস্ট রিপোর্ট করুন",aboutText:"মানুষের সঙ্গে সংযোগ, গল্প ও ইতিবাচক কমিউনিটি।",friendsSoon:"বন্ধু খোঁজা ও friend request ফিচার পরবর্তী ধাপে যুক্ত হবে।",messagesSoon:"নিরাপদ ব্যক্তিগত মেসেজিং পরবর্তী ধাপে যুক্ত হবে।",notificationsSoon:"নোটিফিকেশন সেন্টার পরবর্তী ধাপে যুক্ত হবে।"},
  en: {welcome:"Welcome",home:"Home",stories:"Stories",friends:"Friends",messages:"Messages",notifications:"Notifications",profile:"Profile",sidebarNote:"Stay connected and share safely.",headline:"Stay close to your community",subheadline:"Share thoughts, stories and moments.",accountTitle:"Get started",login:"Log in",register:"Create account",email:"Email",password:"Password",fullName:"Your name",firebaseHint:"Add your Firebase Web config to enable accounts and saved posts.",createPost:"Create a post",postPlaceholder:"What is on your mind today?",publish:"Publish",latestPosts:"Latest posts",emptyFeed:"No posts yet",emptyFeedHint:"Be the first to share something.",aiCorner:"AI corner",botDisclosure:"These assistants are AI, not real people.",safeSpace:"A safer community",guideline1:"Be respectful",guideline2:"Protect personal information",guideline3:"Report harmful content",aboutText:"Connect with people and build a positive community.",friendsSoon:"Find friends and friend requests are planned for a later phase.",messagesSoon:"Secure private messaging is planned for a later phase.",notificationsSoon:"The notification center is planned for a later phase."}
};
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function applyLanguage(){document.documentElement.lang=state.lang;document.querySelectorAll("[data-i18n]").forEach(el=>{const value=copy[state.lang][el.dataset.i18n];if(value)el.textContent=value});document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{const value=copy[state.lang][el.dataset.i18nPlaceholder];if(value)el.placeholder=value});$("languageBtn").textContent=state.lang==="bn"?"EN":"বাং"}
function renderBots(){$("botList").innerHTML=BOTS.map(bot=>`<article class="bot-card"><strong>${escapeHtml(bot.name)}</strong><span class="ai-label">AI</span><p>${escapeHtml(bot.bio)}</p><span class="tiny muted">${escapeHtml(bot.category)}</span></article>`).join("")}

function listenNotifications(){
  if(state.notificationUnsubscribe)state.notificationUnsubscribe();
  const {collection,query,where,orderBy,limit,onSnapshot}=state.firebase;
  const q=query(collection(state.db,"notifications"),where("recipientUid","==",state.user.uid),orderBy("createdAt","desc"),limit(30));
  state.notificationUnsubscribe=onSnapshot(q,snap=>{
    const items=snap.docs.map(d=>({id:d.id,...d.data()}));
    $("notificationList").innerHTML=items.length?items.map(n=>'<div class="member-row notification-row '+(n.read?"is-read":"")+'"><div><strong>'+escapeHtml(n.title||"Notification")+'</strong><small>'+escapeHtml(n.body||"")+'</small></div>'+(n.read?"":'<button class="small-btn notification-read" data-id="'+escapeHtml(n.id)+'">পড়া হয়েছে</button>')+'</div>').join(""):'<p class="tiny muted">এখনো কোনো নোটিফিকেশন নেই।</p>';
  },error=>{console.error(error);$("notificationList").textContent="নোটিফিকেশন লোড করা যায়নি।"});
}
async function markNotificationRead(id){
  try{await state.firebase.updateDoc(state.firebase.doc(state.db,"notifications",id),{read:true})}
  catch(error){console.error(error);toast("নোটিফিকেশন আপডেট হয়নি")}
}
async function enablePushNotifications(){
  if(!state.user){toast("Push চালু করতে লগইন করুন");return}
  if(!firebaseConfig.vapidKey){toast("Firebase Web Push certificate থেকে VAPID key যোগ করতে হবে");return}
  if(!("serviceWorker" in navigator)||!("Notification" in window)){toast("এই ব্রাউজারে Push notification সমর্থিত নয়");return}
  try{
    const permission=await Notification.requestPermission();
    if(permission!=="granted"){toast("Notification permission দেওয়া হয়নি");return}
    const messagingMod=await import("https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging.js");
    if(!(await messagingMod.isSupported())){toast("এই ব্রাউজারে Firebase Messaging সমর্থিত নয়");return}
    const messaging=messagingMod.getMessaging(state.firebase.getApp());
    const registration=await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    const token=await messagingMod.getToken(messaging,{vapidKey:firebaseConfig.vapidKey,serviceWorkerRegistration:registration});
    if(!token){toast("Push token তৈরি হয়নি");return}
    const tokenId=encodeURIComponent(token);
    await state.firebase.setDoc(state.firebase.doc(state.db,"users",state.user.uid,"fcmTokens",tokenId),{token,createdAt:state.firebase.serverTimestamp()});
    toast("Push notification চালু হয়েছে");
  }catch(error){console.error(error);toast("Push চালু হয়নি; Firebase Messaging সেটিংস দেখুন")}
}
function listenStories(){
  if(state.storiesUnsubscribe)state.storiesUnsubscribe();
  const {collection,query,where,orderBy,limit,onSnapshot,Timestamp}=state.firebase;
  const q=query(collection(state.db,"stories"),where("expiresAt",">",Timestamp.now()),orderBy("expiresAt","asc"),limit(20));
  state.storiesUnsubscribe=onSnapshot(q,snap=>{
    const stories=snap.docs.map(d=>({id:d.id,...d.data()}));
    $("storyFeed").innerHTML=stories.length?stories.map(s=>'<button type="button" class="story-tile live-story" data-story="'+escapeHtml(s.id)+'"><span class="story-ring">✦</span><strong>'+escapeHtml(s.authorName||"Member")+'</strong><small>'+escapeHtml(s.text)+'</small></button>').join(""):'<p class="tiny muted">এখনো কোনো সক্রিয় স্টোরি নেই।</p>';
  },error=>{console.error(error);$("storyFeed").textContent="স্টোরি লোড করা যায়নি।"});
}
async function createStory(){
  if(!state.user){toast("স্টোরি দিতে লগইন করুন");return}
  const text=prompt("আপনার ২৪ ঘণ্টার স্টোরি লিখুন (সর্বোচ্চ ২৪০ অক্ষর):");
  if(!text||!text.trim())return;
  try{
    const {collection,addDoc,serverTimestamp,Timestamp}=state.firebase;
    await addDoc(collection(state.db,"stories"),{uid:state.user.uid,authorName:state.user.displayName||"Member",text:text.trim().slice(0,240),createdAt:serverTimestamp(),expiresAt:Timestamp.fromDate(new Date(Date.now()+24*60*60*1000))});
    toast("স্টোরি যোগ হয়েছে");
  }catch(error){console.error(error);toast("স্টোরি যোগ করা যায়নি")}
}
function listenGroups(){
  if(state.groupsUnsubscribe)state.groupsUnsubscribe();
  const {collection,query,orderBy,limit,onSnapshot}=state.firebase;
  const q=query(collection(state.db,"groups"),orderBy("createdAt","desc"),limit(30));
  state.groupsUnsubscribe=onSnapshot(q,async snap=>{
    const groups=snap.docs.map(d=>({id:d.id,...d.data()}));
    const memberships=await Promise.all(groups.map(async g=>{
      try{return (await state.firebase.getDoc(state.firebase.doc(state.db,"groups",g.id,"members",state.user.uid))).exists()?g.id:null}
      catch{return null}
    }));
    state.groupMemberships=new Set(memberships.filter(Boolean));
    $("groupList").innerHTML=groups.length?groups.map(g=>'<div class="member-row group-row"><div><strong>'+escapeHtml(g.name||"Community group")+'</strong><small>'+escapeHtml(g.description||"Public community")+'</small></div><button class="small-btn group-join" data-id="'+escapeHtml(g.id)+'" '+(state.groupMemberships.has(g.id)?"disabled":"")+'>'+(state.groupMemberships.has(g.id)?"Joined":"Join")+'</button></div>').join(""):'<p class="tiny muted">এখনো কোনো গ্রুপ নেই। প্রথম গ্রুপটি তৈরি করুন।</p>';
  },error=>{console.error(error);toast("গ্রুপ লোড করা যায়নি")});
}
async function createGroup(event){
  event.preventDefault();if(!state.user)return;
  const name=$("groupName").value.trim(),description=$("groupDescription").value.trim();
  if(!name)return;
  try{
    const {collection,doc,addDoc,setDoc,serverTimestamp}=state.firebase;
    const group=await addDoc(collection(state.db,"groups"),{name,description,createdBy:state.user.uid,createdAt:serverTimestamp(),visibility:"public"});
    await setDoc(doc(state.db,"groups",group.id,"members",state.user.uid),{uid:state.user.uid,displayName:state.user.displayName||"Member",joinedAt:serverTimestamp()});
    $("groupForm").reset();toast("গ্রুপ তৈরি হয়েছে");
  }catch(error){console.error(error);toast("গ্রুপ তৈরি করা যায়নি")}
}
async function joinGroup(id){
  if(!state.user)return;
  try{
    const {doc,setDoc,serverTimestamp}=state.firebase;
    await setDoc(doc(state.db,"groups",id,"members",state.user.uid),{uid:state.user.uid,displayName:state.user.displayName||"Member",joinedAt:serverTimestamp()});
    toast("গ্রুপে যুক্ত হয়েছেন");
  }catch(error){console.error(error);toast("গ্রুপে যোগ দেওয়া যায়নি")}
}
function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function setAuthMode(mode){state.mode=mode;const registering=mode==="register";$("loginTab").classList.toggle("active",!registering);$("registerTab").classList.toggle("active",registering);$("nameField").classList.toggle("hidden",!registering);$("authSubmit").textContent=registering?copy[state.lang].register:copy[state.lang].login;$("passwordInput").autocomplete=registering?"new-password":"current-password"}
function setUser(user){state.user=user;$("authPanel").classList.toggle("hidden",Boolean(user));$("composerPanel").classList.toggle("hidden",!user);$("postHint").textContent=user?user.email:"";$("publishBtn").disabled=!user;$("sidebarUser").innerHTML=user?`<div class="avatar">${escapeHtml((user.displayName||user.email||"M").slice(0,1).toUpperCase())}</div><div><strong>${escapeHtml(user.displayName||"MySocial member")}</strong><small>${escapeHtml(user.email||"")}</small></div>`:`<div class="avatar">M</div><div><strong>MySocial2</strong><small>${copy[state.lang].welcome}</small></div>`;$("profileSummary").textContent=user?`${user.displayName||"MySocial member"} · ${user.email}`:"লগইন করলে আপনার প্রোফাইল এখানে দেখা যাবে।";$("adminNav").hidden=!user?.isAdmin;$("adminPanel").classList.toggle("hidden",!user?.isAdmin);$("logoutNav").hidden=!user}

async function searchMembers(){
  if(!state.user||!state.db)return;
  const term=$("memberSearch").value.trim();
  if(term.length<2){$("memberResults").innerHTML='<p class="muted tiny">কমপক্ষে ২টি অক্ষর লিখুন।</p>';return}
  try{
    const {collection,query,orderBy,startAt,endAt,limit,getDocs}=state.firebase;
    const q=query(collection(state.db,"publicProfiles"),orderBy("displayName"),startAt(term),endAt(term+"\uf8ff"),limit(10));
    const snap=await getDocs(q);
    const members=snap.docs.filter(d=>d.id!==state.user.uid);
    $("memberResults").innerHTML=members.length?members.map(d=>'<div class="member-row"><div><strong>'+escapeHtml(d.data().displayName||"Member")+'</strong><small>MySocial member</small></div><button class="small-btn friend-add" data-uid="'+escapeHtml(d.id)+'" data-name="'+escapeHtml(d.data().displayName||"Member")+'">Add friend</button></div>').join(""):'<p class="muted tiny">কোনো সদস্য পাওয়া যায়নি।</p>';
  }catch(error){console.error(error);toast("সদস্য খোঁজা যায়নি")}
}
async function sendFriendRequest(uid,name){
  if(!state.user||uid===state.user.uid)return;
  try{
    const {doc,setDoc,serverTimestamp}=state.firebase;
    const senderUid=state.user.uid;
    const requestId=[senderUid,uid].sort().join("_");
    await setDoc(doc(state.db,"friendRequests",requestId),{senderUid,senderName:state.user.displayName||"Member",recipientUid:uid,recipientName:name,status:"pending",createdAt:serverTimestamp()});
    toast("Friend request sent");
  }catch(error){console.error(error);toast("Request failed")}
}
function listenFriendRequests(){
  const {collection,query,where,onSnapshot}=state.firebase;
  const q=query(collection(state.db,"friendRequests"),where("recipientUid","==",state.user.uid),where("status","==","pending"));
  onSnapshot(q,snap=>{
    state.friendRequests=snap.docs.map(d=>({id:d.id,...d.data()}));
    $("friendRequests").innerHTML=state.friendRequests.length?state.friendRequests.map(r=>'<div class="member-row"><div><strong>'+escapeHtml(r.senderName||"Member")+'</strong><small>Friend request</small></div><div><button class="small-btn request-accept" data-id="'+r.id+'">Accept</button> <button class="text-btn request-decline" data-id="'+r.id+'">Decline</button></div></div>').join(""):'<p class="muted tiny">নতুন friend request নেই।</p>';
    $("requestCount").textContent=String(state.friendRequests.length);
  },error=>{console.error(error);toast("Requests could not load")});
}
async function respondFriendRequest(id,status){
  try{
    const {doc,getDoc,writeBatch,serverTimestamp}=state.firebase;
    const requestRef=doc(state.db,"friendRequests",id);
    const requestSnap=await getDoc(requestRef);
    if(!requestSnap.exists()){toast("অনুরোধটি আর পাওয়া যাচ্ছে না");return}
    const request=requestSnap.data();
    if(request.recipientUid!==state.user.uid||request.status!=="pending"){toast("অনুরোধটি আপডেট করা যাচ্ছে না");return}
    const batch=writeBatch(state.db);
    batch.update(requestRef,{status});
    if(status==="accepted"){
      batch.set(doc(state.db,"friendships",id),{
        senderUid:request.senderUid,recipientUid:request.recipientUid,
        senderName:request.senderName||"Member",recipientName:request.recipientName||"Member",
        members:[request.senderUid,request.recipientUid],createdAt:serverTimestamp()
      });
    }
    await batch.commit();
    toast(status==="accepted"?"Friend request accepted":"Request declined");
  }catch(error){console.error(error);toast("Could not update request")}
}


function listenFriends(){
  const {collection,query,where,onSnapshot}=state.firebase;
  const q=query(collection(state.db,"friendships"),where("members","array-contains",state.user.uid));
  onSnapshot(q,snap=>{
    state.friends=snap.docs.map(d=>{
      const f=d.data();
      const otherIsSender=f.senderUid!==state.user.uid;
      return {uid:otherIsSender?f.senderUid:f.recipientUid,name:(otherIsSender?f.senderName:f.recipientName)||"MySocial member"};
    });
    $("friendsList").innerHTML=state.friends.length?state.friends.map(f=>'<div class="member-row"><div><strong>'+escapeHtml(f.name)+'</strong><small>Friend</small></div><button class="small-btn chat-start" data-uid="'+escapeHtml(f.uid)+'" data-name="'+escapeHtml(f.name)+'">Message</button></div>').join(""):'<p class="tiny muted">এখনো কোনো বন্ধু নেই। অনুরোধ গ্রহণ হলে এখানে দেখা যাবে।</p>';
  },error=>{console.error(error);toast("বন্ধুদের তালিকা লোড করা যায়নি")});
}
function listenChats(){
  const {collection,query,where,onSnapshot}=state.firebase;
  const q=query(collection(state.db,"chats"),where("participants","array-contains",state.user.uid));
  onSnapshot(q,s=>{
    state.chats=s.docs.map(d=>({id:d.id,...d.data()}));
    $("chatList").innerHTML=state.chats.length?state.chats.map(ch=>{
      const other=ch.participants.find(uid=>uid!==state.user.uid);
      const friend=state.friends.find(f=>f.uid===other);
      return '<button type="button" class="chat-row '+(state.activeChatId===ch.id?'selected':'')+'" data-chat="'+escapeHtml(ch.id)+'"><strong>'+escapeHtml(friend?.name||"MySocial member")+'</strong><small>'+escapeHtml(ch.lastMessage||"Conversation")+'</small></button>';
    }).join(""):'<p class="tiny muted">কোনো চ্যাট নেই। বন্ধু তালিকা থেকে Message চাপুন।</p>';
  },e=>{console.error(e);toast("Chat list could not load")});
}
async function openChat(uid,name){
  const participants=[state.user.uid,uid].sort();
  const chatId=participants.join("_");
  const {doc,setDoc,serverTimestamp}=state.firebase;
  try{
    const chatRef=doc(state.db,"chats",chatId);
    await setDoc(chatRef,{participants,updatedAt:serverTimestamp()},{merge:true});
    state.activeChatId=chatId;
    $("activeChatTitle").textContent=name;
    $("chatForm").classList.remove("hidden");
    if(state.messageUnsubscribe)state.messageUnsubscribe();
    const {collection,query,orderBy,limit,onSnapshot}=state.firebase;
    const q=query(collection(state.db,"chats",chatId,"messages"),orderBy("createdAt","asc"),limit(100));
    state.messageUnsubscribe=onSnapshot(q,s=>{
      $("messageList").innerHTML=s.docs.map(d=>{
        const m=d.data(),mine=m.senderUid===state.user.uid;
        return '<div class="message-bubble '+(mine?'mine':'')+'">'+escapeHtml(m.text)+'</div>';
      }).join("");
      $("messageList").scrollTop=$("messageList").scrollHeight;
    },e=>{console.error(e);toast("Messages could not load")});
    $("chatList").querySelectorAll(".chat-row").forEach(el=>el.classList.toggle("selected",el.dataset.chat===chatId));
    $("messageText").focus();
  }catch(error){console.error(error);toast("Could not open chat")}
}
async function sendMessage(event){
  event.preventDefault();
  const text=$("messageText").value.trim();
  if(!text||!state.activeChatId)return;
  const {collection,addDoc,doc,updateDoc,serverTimestamp}=state.firebase;
  try{
    await addDoc(collection(state.db,"chats",state.activeChatId,"messages"),{senderUid:state.user.uid,text,createdAt:serverTimestamp()});
    await updateDoc(doc(state.db,"chats",state.activeChatId),{lastMessage:text.slice(0,120),updatedAt:serverTimestamp()});
    $("messageText").value="";
  }catch(error){console.error(error);toast("Message could not be sent")}
}

function renderFeed(){
 const feed=$("feed");$("feedCount").textContent=`${state.posts.length} posts`;
 if(!state.posts.length){feed.innerHTML=`<div class="empty-state panel"><div class="empty-icon">✧</div><h3>${copy[state.lang].emptyFeed}</h3><p class="muted">${copy[state.lang].emptyFeedHint}</p></div>`;return}
 feed.innerHTML=state.posts.map(post=>{
  const liked=(post.likedBy||[]).includes(state.user?.uid);
  return `<article class="post-card panel" data-post-id="${escapeHtml(post.id)}"><div class="post-head"><div class="avatar">${escapeHtml((post.authorName||"M").slice(0,1).toUpperCase())}</div><div class="post-author"><strong>${escapeHtml(post.authorName||"MySocial member")}</strong><small>${escapeHtml(post.createdLabel||"Just now")}</small></div></div><p class="post-content">${escapeHtml(post.text)}</p>${post.imageUrl?'<img class="post-image" src="'+escapeHtml(post.imageUrl)+'" alt="Post image" loading="lazy">':""}<div class="post-meta"><span>${(post.likedBy||[]).length} likes</span></div><div class="post-actions"><button class="text-btn like-btn ${liked?"is-liked":""}" type="button" data-id="${escapeHtml(post.id)}" ${!state.user?"disabled":""}>♥ ${liked?"Liked":"Like"}</button><button class="text-btn report-btn" type="button" data-id="${escapeHtml(post.id)}" ${!state.user?"disabled":""}>⚑ Report</button>${post.uid===state.user?.uid?'<button class="text-btn delete-btn" type="button" data-id="'+escapeHtml(post.id)+'">Delete</button>':""}</div><div class="post-comments" id="comments-${escapeHtml(post.id)}"><p class="tiny muted">মন্তব্য লোড হচ্ছে…</p></div><form class="comment-form" data-id="${escapeHtml(post.id)}"><input class="comment-input" maxlength="500" placeholder="একটি মন্তব্য লিখুন…" ${!state.user?"disabled":""} required><button class="text-btn" type="submit" ${!state.user?"disabled":""}>মন্তব্য</button></form></article>`
 }).join("");
 state.posts.forEach(post=>loadPostComments(post.id))
}


async function loadPostComments(postId){
 const target=$("comments-"+postId);if(!target||!state.firebase)return;
 try{
  const {collection,query,orderBy,limit,getDocs}=state.firebase;
  const q=query(collection(state.db,"posts",postId,"comments"),orderBy("createdAt","asc"),limit(10));
  const snap=await getDocs(q);
  const current=$("comments-"+postId);if(!current)return;
  current.innerHTML=snap.empty?'<p class="tiny muted">এখনো কোনো মন্তব্য নেই।</p>':snap.docs.map(d=>{const c=d.data();return '<p class="comment-item"><strong>'+escapeHtml(c.authorName||"Member")+'</strong> '+escapeHtml(c.text)+'</p>'}).join("");
 }catch(error){console.error(error);const current=$("comments-"+postId);if(current)current.textContent="মন্তব্য লোড করা যায়নি।"}
}
async function submitComment(event){
 event.preventDefault();const form=event.target.closest(".comment-form");if(!form||!state.user)return;
 const postId=form.dataset.id,input=form.querySelector(".comment-input"),text=input.value.trim();if(!text)return;
 try{
  const {collection,addDoc,serverTimestamp}=state.firebase;
  await addDoc(collection(state.db,"posts",postId,"comments"),{uid:state.user.uid,authorName:state.user.displayName||"MySocial member",text,createdAt:serverTimestamp()});
  input.value="";await loadPostComments(postId);toast("মন্তব্য যোগ হয়েছে");
 }catch(error){console.error(error);toast("মন্তব্য যোগ করা যায়নি")}
}

async function toggleLike(id){
 if(!state.user){toast("লাইক দিতে লগইন করুন");return}
 const post=state.posts.find(p=>p.id===id);if(!post)return;
 const liked=(post.likedBy||[]).includes(state.user.uid);
 try{const {doc,updateDoc,arrayUnion,arrayRemove}=state.firebase;await updateDoc(doc(state.db,"posts",id),{likedBy:liked?arrayRemove(state.user.uid):arrayUnion(state.user.uid)})}
 catch(error){console.error(error);toast("Like update failed")}
}
function listenAdminReports(){
 if(state.adminReportsUnsubscribe)state.adminReportsUnsubscribe();
 const {collection,query,where,onSnapshot}=state.firebase;
 const q=query(collection(state.db,"reports"),where("status","==","open"));
 state.adminReportsUnsubscribe=onSnapshot(q,snap=>{
  const reports=snap.docs.map(d=>({id:d.id,...d.data()})).sort((x,y)=>(y.createdAt?.seconds||0)-(x.createdAt?.seconds||0));
  $("adminSummary").textContent=`${reports.length}টি খোলা রিপোর্ট`;
  $("adminReports").innerHTML=reports.length?reports.map(r=>`<div class="member-row admin-report"><div><strong>Post: ${escapeHtml(r.postId||"unknown")}</strong><small>${escapeHtml(r.reason||"No reason")} · ${escapeHtml(r.reporterUid||"")}</small></div><div><button class="small-btn report-resolve" data-id="${escapeHtml(r.id)}">Resolve</button><button class="text-btn report-remove" data-id="${escapeHtml(r.id)}" data-post="${escapeHtml(r.postId||"")}">Remove post</button></div></div>`).join(""):'<p class="tiny muted">কোনো খোলা রিপোর্ট নেই।</p>';
 },error=>{console.error(error);$("adminReports").textContent="রিপোর্ট লোড করা যায়নি। Firebase admin claim ও rules যাচাই করুন।"});
}
async function resolveReport(id){
 try{await state.firebase.updateDoc(state.firebase.doc(state.db,"reports",id),{status:"resolved"});toast("Report resolved")}
 catch(error){console.error(error);toast("রিপোর্ট আপডেট হয়নি")}
}
async function removeReportedPost(reportId,postId){
 if(!postId||!confirm("এই রিপোর্ট করা পোস্টটি মুছে ফেলবেন?"))return;
 try{
  const postRef=state.firebase.doc(state.db,"posts",postId),postSnap=await state.firebase.getDoc(postRef);
  const imagePath=postSnap.exists()?postSnap.data().imagePath:null;
  await state.firebase.deleteDoc(postRef);
  if(imagePath)await state.firebase.deleteObject(state.firebase.ref(state.storage,imagePath));
  await state.firebase.updateDoc(state.firebase.doc(state.db,"reports",reportId),{status:"actioned"});
  toast("পোস্ট সরানো হয়েছে");
 }catch(error){console.error(error);toast("পোস্ট সরানো যায়নি")}
}

async function initFirebase(){if(!isFirebaseConfigured){$("connectionStatus").textContent="Firebase setup needed";return}try{const [appMod,authMod,dbMod,storageMod]=await Promise.all([import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js"),import("https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js"),import("https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js"),import("https://www.gstatic.com/firebasejs/13.2.0/firebase-storage.js")]);state.firebase={...appMod,...authMod,...dbMod,...storageMod};const app=appMod.initializeApp(firebaseConfig);state.auth=authMod.getAuth(app);state.db=dbMod.getFirestore(app);state.storage=storageMod.getStorage(app);$("connectionStatus").textContent="Firebase connected";authMod.onAuthStateChanged(state.auth,async user=>{if(!user){if(state.adminReportsUnsubscribe){state.adminReportsUnsubscribe();state.adminReportsUnsubscribe=null}if(state.storiesUnsubscribe){state.storiesUnsubscribe();state.storiesUnsubscribe=null}if(state.groupsUnsubscribe){state.groupsUnsubscribe();state.groupsUnsubscribe=null}if(state.notificationUnsubscribe){state.notificationUnsubscribe();state.notificationUnsubscribe=null}setUser(null);state.posts=[];state.friendRequests=[];state.friends=[];state.chats=[];state.groupMemberships.clear();renderFeed();$("storyFeed").innerHTML='<p class="tiny muted">লগইন করলে স্টোরি দেখা যাবে।</p>';$("groupList").innerHTML='<p class="tiny muted">লগইন করলে গ্রুপ দেখা যাবে।</p>';$("notificationList").innerHTML='<p class="tiny muted">লগইন করলে নোটিফিকেশন দেখা যাবে।</p>';$("adminReports").innerHTML="";return}const token=await user.getIdTokenResult();setUser({...user,isAdmin:token.claims.admin===true});listenPosts();listenFriendRequests();listenFriends();listenChats();listenStories();listenGroups();listenNotifications();if(token.claims.admin===true)listenAdminReports()})}catch(error){console.error(error);$("connectionStatus").textContent="Connection error";toast("Firebase connection failed. Check config.")}}
async function submitAuth(event){event.preventDefault();$("authMessage").textContent="";if(!state.auth){$("authMessage").textContent="Firebase config যোগ করার পর লগইন চালু হবে।";return}const email=$("emailInput").value.trim(),password=$("passwordInput").value;try{if(state.mode==="register"){const credential=await state.firebase.createUserWithEmailAndPassword(state.auth,email,password);const name=$("nameInput").value.trim()||"MySocial member";await state.firebase.updateProfile(credential.user,{displayName:name});await state.firebase.setDoc(state.firebase.doc(state.db,"users",credential.user.uid),{displayName:name,email,createdAt:state.firebase.serverTimestamp(),bio:""});await state.firebase.setDoc(state.firebase.doc(state.db,"publicProfiles",credential.user.uid),{displayName:name,createdAt:state.firebase.serverTimestamp()});toast("Account created")}else{await state.firebase.signInWithEmailAndPassword(state.auth,email,password);toast("Welcome back")}}catch(error){$("authMessage").textContent=error.message}}
function listenPosts(){const {collection,query,where,orderBy,limit,onSnapshot}=state.firebase;const q=query(collection(state.db,"posts"),where("status","==","published"),orderBy("createdAt","desc"),limit(40));onSnapshot(q,snapshot=>{state.posts=snapshot.docs.map(doc=>({id:doc.id,...doc.data(),createdLabel:doc.data().createdAt?.toDate?.().toLocaleString()||"Just now"}));renderFeed()},error=>{console.error(error);toast("Could not load posts")})}
async function createPost(event){
 event.preventDefault();if(!state.user||!state.db){toast("Firebase sign-in is required");return}
 const text=$("postText").value.trim(),file=$("postImage").files?.[0];if(!text&&!file){toast("লেখা বা একটি ছবি যোগ করুন");return}
 let uploadedPath=null;
 try{
  let imageUrl=null;
  if(file){
    if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)||file.size>5*1024*1024){toast("শুধু JPG, PNG, WEBP বা GIF ছবি (সর্বোচ্চ ৫ MB) দিন");return}
    const cleanName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-80);
    uploadedPath="post-images/"+state.user.uid+"/"+Date.now()+"-"+cleanName;
    const storageRef=state.firebase.ref(state.storage,uploadedPath);
    await state.firebase.uploadBytes(storageRef,file,{contentType:file.type});
    imageUrl=await state.firebase.getDownloadURL(storageRef);
  }
  await state.firebase.addDoc(state.firebase.collection(state.db,"posts"),{uid:state.user.uid,authorName:state.user.displayName||"MySocial member",text,createdAt:state.firebase.serverTimestamp(),status:"published",reportCount:0,likedBy:[],...(imageUrl?{imageUrl,imagePath:uploadedPath}:{})});
  $("postText").value="";$("postImage").value="";toast("Post published");
 }catch(error){console.error(error);if(uploadedPath){try{await state.firebase.deleteObject(state.firebase.ref(state.storage,uploadedPath))}catch{}}toast("Post could not be published")}
}
async function reportPost(id){if(!state.user||!state.db){toast("Please sign in first");return}const reason=prompt("Report reason (spam, harassment, privacy, other):");if(!reason)return;try{await state.firebase.addDoc(state.firebase.collection(state.db,"reports"),{postId:id,reporterUid:state.user.uid,reason:reason.slice(0,300),createdAt:state.firebase.serverTimestamp(),status:"open"});toast("Report submitted")}catch(error){console.error(error);toast("Report failed")}}
async function deletePost(id){const post=state.posts.find(p=>p.id===id);if(!post||post.uid!==state.user?.uid)return;if(!confirm("Delete this post?"))return;try{await state.firebase.deleteDoc(state.firebase.doc(state.db,"posts",id));if(post.imagePath)await state.firebase.deleteObject(state.firebase.ref(state.storage,post.imagePath));toast("Post deleted")}catch(error){console.error(error);toast("Delete failed")}}
$("authForm").addEventListener("submit",submitAuth);$("enablePushBtn").addEventListener("click",enablePushNotifications);$("notificationList").addEventListener("click",event=>{const btn=event.target.closest(".notification-read");if(btn)markNotificationRead(btn.dataset.id)});$("createStoryBtn").addEventListener("click",createStory);$("groupForm").addEventListener("submit",createGroup);$("groupList").addEventListener("click",event=>{const btn=event.target.closest(".group-join");if(btn)joinGroup(btn.dataset.id)});$("storyFeed").addEventListener("click",event=>{const btn=event.target.closest(".live-story");if(btn){const story=state.firebase.doc(state.db,"stories",btn.dataset.story);state.firebase.getDoc(story).then(s=>{if(s.exists())alert((s.data().authorName||"Member")+"\n\n"+s.data().text)})}});$("loginTab").addEventListener("click",()=>setAuthMode("login"));$("registerTab").addEventListener("click",()=>setAuthMode("register"));$("postForm").addEventListener("submit",createPost);$("memberSearchBtn").addEventListener("click",searchMembers);$("memberSearch").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();searchMembers()}});$("memberResults").addEventListener("click",event=>{const btn=event.target.closest(".friend-add");if(btn)sendFriendRequest(btn.dataset.uid,btn.dataset.name)});$("friendsList").addEventListener("click",event=>{const btn=event.target.closest(".chat-start");if(btn)openChat(btn.dataset.uid,btn.dataset.name)});$("chatList").addEventListener("click",event=>{const btn=event.target.closest(".chat-row");if(btn){const chat=state.chats.find(c=>c.id===btn.dataset.chat);const other=chat?.participants.find(uid=>uid!==state.user.uid);const friend=state.friends.find(f=>f.uid===other);if(chat)openChat(other,friend?.name||"MySocial member")}});$("chatForm").addEventListener("submit",sendMessage);$("adminReports").addEventListener("click",event=>{const resolve=event.target.closest(".report-resolve"),remove=event.target.closest(".report-remove");if(resolve)resolveReport(resolve.dataset.id);if(remove)removeReportedPost(remove.dataset.id,remove.dataset.post)});$("friendRequests").addEventListener("click",event=>{const yes=event.target.closest(".request-accept"),no=event.target.closest(".request-decline");if(yes)respondFriendRequest(yes.dataset.id,"accepted");if(no)respondFriendRequest(no.dataset.id,"declined")});$("feed").addEventListener("submit",event=>{if(event.target.closest(".comment-form"))submitComment(event)});$("feed").addEventListener("click",event=>{const like=event.target.closest(".like-btn"),report=event.target.closest(".report-btn"),del=event.target.closest(".delete-btn");if(like)toggleLike(like.dataset.id);if(report)reportPost(report.dataset.id);if(del)deletePost(del.dataset.id)});$("languageBtn").addEventListener("click",()=>{state.lang=state.lang==="bn"?"en":"bn";applyLanguage();setAuthMode(state.mode);renderBots();renderFeed()});$("themeBtn").addEventListener("click",()=>{document.body.classList.toggle("dark");$("themeBtn").textContent=document.body.classList.contains("dark")?"☀":"☾"});$("adminNav").addEventListener("click",()=>$("adminPanel").scrollIntoView({behavior:"smooth"}));$("logoutNav").addEventListener("click",async()=>{if(state.auth){await state.firebase.signOut(state.auth);toast("Signed out")}});$("installBtn").addEventListener("click",async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$("installBtn").classList.add("hidden")});window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();state.deferredInstall=event;$("installBtn").classList.remove("hidden")});
applyLanguage();setAuthMode("login");renderBots();renderFeed();initFirebase();
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
