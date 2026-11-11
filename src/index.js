const SYSTEM_INSTRUCTION = `আপনি KING CODER, একজন সহায়ক AI coding assistant। ব্যবহারকারীর ভাষায় উত্তর দিন; বাংলা হলে স্বাভাবিক, পরিষ্কার বাংলায় উত্তর দিন এবং সম্মানসূচক “আপনি” ব্যবহার করুন।
আপনি ওয়েবসাইট পরিকল্পনা, UI/UX, frontend/backend কোড, debugging, testing ও deployment-এর নির্দেশনা দিতে পারেন। ব্যবহারকারীকে কখনো বলবেন না যে আপনি GitHub-এ কোড আপলোড, পরীক্ষা, বা deploy করেছেন যদি তা বাস্তবে কোনো tool দিয়ে করা না হয়ে থাকে। GitHub সংযোগ থাকলে অনুমোদিত repository API ব্যবহার করে কাজ করতে পারবেন। কোনো কাজ tool দিয়ে বাস্তবে সফল না হলে সফল হয়েছে বলবেন না। গোপন API key চাইবেন না এবং ব্যবহারকারীকে chat-এ key paste করতে বলবেন না।`;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

const ghEnc=new TextEncoder();
const ghB64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const ghRandom=()=>ghB64(crypto.getRandomValues(new Uint8Array(32)));
async function ghHash(s){return ghB64(await crypto.subtle.digest("SHA-256",ghEnc.encode(s)));}
function ghCookie(req){const c=req.headers.get("Cookie")||"";const m=c.match(/(?:^|;\s*)kc_session=([^;]+)/);return m?m[1]:"";}
function ghSetCookie(v,age){return `kc_session=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;}
async function ghKey(env){if(!env.GITHUB_CLIENT_SECRET)throw new Error("GITHUB_CLIENT_SECRET missing");const material=await crypto.subtle.importKey("raw",ghEnc.encode(env.GITHUB_CLIENT_SECRET),"HKDF",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:ghEnc.encode("KING-CODER-GITHUB-TOKEN-v1"),info:ghEnc.encode("D1 token encryption")},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);}
async function ghEncrypt(env,token){const iv=crypto.getRandomValues(new Uint8Array(12));const out=await crypto.subtle.encrypt({name:"AES-GCM",iv},await ghKey(env),ghEnc.encode(token));return ghB64(iv)+"."+ghB64(out);}
async function ghDecrypt(env,value){const [iv,data]=value.split(".");const dec=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:dec(iv)},await ghKey(env),dec(data)));}
async function ghApi(path,token,opts={}){return fetch("https://api.github.com"+path,{...opts,headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"KING-CODER",...(opts.headers||{})}});}
async function ghSession(req,env){if(!env.DB)return null;const raw=ghCookie(req);if(!raw)return null;const row=await env.DB.prepare("SELECT s.user_id,s.expires_at,c.username,c.encrypted_token FROM sessions s JOIN github_connections c ON c.user_id=s.user_id WHERE s.session_hash=?1").bind(await ghHash(raw)).first();return row&&row.expires_at>Date.now()?row:null;}
async function ghRoutes(req,env,url){
 const reply=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...h}});
 if(url.pathname==="/api/github/login"&&req.method==="GET"){
  if(!env.DB||!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)return reply({error:"GitHub OAuth এখনো কনফিগার করা হয়নি।"},503);
  const state=ghRandom();await env.DB.prepare("INSERT INTO oauth_states(state_hash,expires_at) VALUES(?1,?2)").bind(await ghHash(state),Date.now()+600000).run();
  const target=new URL("https://github.com/login/oauth/authorize");target.searchParams.set("client_id",env.GITHUB_CLIENT_ID);target.searchParams.set("redirect_uri",url.origin+"/api/github/callback");target.searchParams.set("scope","repo read:user");target.searchParams.set("state",state);return Response.redirect(target.toString(),302);
 }
 if(url.pathname==="/api/github/callback"&&req.method==="GET"){
  if(!env.DB||!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)return reply({error:"GitHub OAuth configuration missing."},503);
  const state=url.searchParams.get("state")||"",code=url.searchParams.get("code")||"";if(!state||!code)return reply({error:"GitHub authorization বাতিল হয়েছে।"},400);
  const hash=await ghHash(state),saved=await env.DB.prepare("SELECT expires_at FROM oauth_states WHERE state_hash=?1").bind(hash).first();await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash=?1").bind(hash).run();if(!saved||saved.expires_at<Date.now())return reply({error:"OAuth state অবৈধ বা মেয়াদোত্তীর্ণ। আবার চেষ্টা করুন।"},400);
  const exchange=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code})});const auth=await exchange.json().catch(()=>({}));if(!exchange.ok||!auth.access_token)return reply({error:"GitHub token exchange ব্যর্থ হয়েছে।"},502);
  const ur=await ghApi("/user",auth.access_token),user=await ur.json().catch(()=>({}));if(!ur.ok||!user.id||!user.login)return reply({error:"GitHub account যাচাই করা যায়নি।"},502);
  const encrypted=await ghEncrypt(env,auth.access_token);await env.DB.prepare("INSERT INTO github_connections(user_id,username,encrypted_token,created_at) VALUES(?1,?2,?3,?4) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,encrypted_token=excluded.encrypted_token,created_at=excluded.created_at").bind(String(user.id),user.login,encrypted,Date.now()).run();
  const session=ghRandom();await env.DB.prepare("INSERT INTO sessions(session_hash,user_id,expires_at) VALUES(?1,?2,?3)").bind(await ghHash(session),String(user.id),Date.now()+2592000000).run();return new Response(null,{status:302,headers:{"Location":url.origin+"/?github=connected","Set-Cookie":ghSetCookie(session,2592000)}});
 }
 if(url.pathname==="/api/github/status"&&req.method==="GET"){const s=await ghSession(req,env);return reply({configured:Boolean(env.DB&&env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET),connected:Boolean(s),username:s?.username||null});}
 if(url.pathname==="/api/github/disconnect"&&req.method==="POST"){const origin=req.headers.get("Origin");if(origin&&origin!==url.origin)return reply({error:"Cross-origin request blocked."},403);if(!env.DB)return reply({error:"D1 database binding নেই।"},503);const raw=ghCookie(req);if(raw)await env.DB.prepare("DELETE FROM sessions WHERE session_hash=?1").bind(await ghHash(raw)).run();return reply({ok:true},200,{"Set-Cookie":ghSetCookie("",0)});}
 if(url.pathname==="/api/github/repos"&&req.method==="GET"){
  const s=await ghSession(req,env);if(!s)return reply({error:"প্রথমে GitHub সংযোগ করুন।"},401);const token=await ghDecrypt(env,s.encrypted_token),r=await ghApi("/user/repos?per_page=50&sort=updated&affiliation=owner,collaborator,organization_member",token),data=await r.json().catch(()=>[]);if(!r.ok)return reply({error:"GitHub repository তালিকা আনা যায়নি।"},502);return reply({repositories:data.map(x=>({name:x.name,full_name:x.full_name,private:x.private,default_branch:x.default_branch,html_url:x.html_url}))});
 }
 if(url.pathname==="/api/github/commit"&&req.method==="POST"){
  const origin=req.headers.get("Origin");if(origin&&origin!==url.origin)return reply({error:"Cross-origin request blocked."},403);
  const s=await ghSession(req,env);if(!s)return reply({error:"প্রথমে GitHub সংযোগ করুন।"},401);let b;try{b=await req.json();}catch{return reply({error:"সঠিক JSON পাঠান।"},400);}
  const owner=String(b.owner||""),repo=String(b.repo||""),branch=String(b.branch||""),message=String(b.message||"").trim(),files=b.files;
  if(owner.toLowerCase()!==s.username.toLowerCase())return reply({error:"নিরাপত্তার জন্য আপাতত শুধু আপনার নিজের repository-তে লেখা যাবে।"},403);
  if(!/^[A-Za-z0-9_.-]{1,100}$/.test(repo)||! /^[A-Za-z0-9_.\\/-]{1,200}$/.test(branch)||!message||message.length>200||!Array.isArray(files)||files.length<1||files.length>20)return reply({error:"Repository, branch, commit message বা file list সঠিক নয়।"},400);
  let total=0;for(const x of files){if(!x||typeof x.path!=="string"||typeof x.content!=="string"||x.path.startsWith("/")||x.path.split("/").includes("..")||x.path.length>240||x.content.length>200000)return reply({error:"ফাইলের path বা content সীমা অতিক্রম করেছে।"},400);total+=x.content.length;}if(total>1000000)return reply({error:"একটি commit-এ সর্বোচ্চ ১ MB content অনুমোদিত।"},413);
  const token=await ghDecrypt(env,s.encrypted_token),base="/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo),ref=await ghApi(base+"/git/ref/heads/"+branch.split("/").map(encodeURIComponent).join("/"),token),r=await ref.json().catch(()=>({}));if(!ref.ok)return reply({error:"Branch পাওয়া যায়নি বা GitHub access নেই।"},502);
  const cr=await ghApi(base+"/git/commits/"+r.object.sha,token),parent=await cr.json().catch(()=>({}));if(!cr.ok||!parent.tree?.sha)return reply({error:"বর্তমান Git commit পড়া যায়নি।"},502);
  const tree=[];for(const x of files){const br=await ghApi(base+"/git/blobs",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:x.content,encoding:"utf-8"})}),blob=await br.json().catch(()=>({}));if(!br.ok||!blob.sha)return reply({error:"GitHub file blob তৈরি করতে পারেনি।"},502);tree.push({path:x.path,mode:"100644",type:"blob",sha:blob.sha});}
  const tr=await ghApi(base+"/git/trees",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({base_tree:parent.tree.sha,tree})}),nt=await tr.json().catch(()=>({}));if(!tr.ok||!nt.sha)return reply({error:"GitHub file tree তৈরি করতে পারেনি।"},502);
  const nc=await ghApi(base+"/git/commits",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,tree:nt.sha,parents:[r.object.sha]})}),commit=await nc.json().catch(()=>({}));if(!nc.ok||!commit.sha)return reply({error:"GitHub commit তৈরি করতে পারেনি।"},502);
  const upd=await ghApi(base+"/git/refs/heads/"+branch.split("/").map(encodeURIComponent).join("/"),token,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({sha:commit.sha,force:false})});if(!upd.ok)return reply({error:"Commit তৈরি হয়েছে, কিন্তু branch update হয়নি। GitHub-এ যাচাই করুন।"},409);return reply({ok:true,commit:commit.sha,url:commit.html_url,files:files.map(x=>x.path)});
 }
 return null;
}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/api/health"&&request.method==="GET"){
   return json({ok:true,service:"KING CODER API",configured:Boolean(env.GEMINI_API_KEY),githubConfigured:Boolean(env.DB&&env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET),databaseConfigured:Boolean(env.DB),model:env.GEMINI_MODEL||"gemini-3.5-flash"});
  }
  const githubResponse=await ghRoutes(request,env,url);if(githubResponse)return githubResponse;
  if(url.pathname==="/api/chat"){
   if(request.method!=="POST")return json({error:"শুধু POST request গ্রহণ করা হয়।"},405);
   if(!env.GEMINI_API_KEY)return json({error:"সার্ভারে GEMINI_API_KEY secret সেট করা নেই।"},503);
   let body;
   try{
    const raw=await request.text();
    if(raw.length>50000)return json({error:"অনুরোধটি অনেক বড়।"},413);
    body=JSON.parse(raw);
   }catch{return json({error:"সঠিক JSON পাঠান।"},400);}
   const message=typeof body.message==="string"?body.message.trim():"";
   if(!message||message.length>12000)return json({error:"বার্তাটি খালি অথবা ১২,০০০ অক্ষরের বেশি।"},400);
   const history=Array.isArray(body.history)?body.history.slice(-16):[];
   const contents=[];
   for(const item of history){
    if(!item||!["user","assistant"].includes(item.role)||typeof item.text!=="string")continue;
    const text=item.text.trim().slice(0,12000);
    if(text)contents.push({role:item.role==="assistant"?"model":"user",parts:[{text}]});
   }
   if(contents.length===0||contents[contents.length-1].role!=="user"||contents[contents.length-1].parts[0].text!==message){
    contents.push({role:"user",parts:[{text:message}]});
   }
   const model=env.GEMINI_MODEL||"gemini-3.5-flash";
   let upstream;
   try{
    upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
     method:"POST",
     headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
     body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM_INSTRUCTION}]},contents,generationConfig:{maxOutputTokens:4096}})
    });
   }catch{return json({error:"AI provider-এর সঙ্গে সংযোগ করা যায়নি।"},502);}
   const payload=await upstream.json().catch(()=>({}));
   if(!upstream.ok){
    const code=upstream.status===429?429:502;
    return json({error:upstream.status===429?"Gemini-এর free quota/rate limit শেষ হয়েছে। পরে আবার চেষ্টা করুন।":"Gemini API request ব্যর্থ হয়েছে। API key ও model configuration পরীক্ষা করুন।"},code);
   }
   const reply=payload.candidates?.[0]?.content?.parts?.map(part=>part.text||"").join("").trim();
   if(!reply)return json({error:"Gemini থেকে খালি উত্তর এসেছে।"},502);
   return json({reply,model});
  }
  if(url.pathname.startsWith("/api/"))return json({error:"API endpoint পাওয়া যায়নি।"},404);
  return env.ASSETS.fetch(request);
 }
};
