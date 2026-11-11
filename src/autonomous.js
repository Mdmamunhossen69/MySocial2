import { generateGemini, getGeminiQuotaState } from "./ai.js";
const cleanText = (v, max=12000) => String(v || "").trim().slice(0,max);
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const safeRepo = v => /^[A-Za-z0-9][A-Za-z0-9._-]{0,90}$/.test(v) && !v.endsWith(".git");
function safePublicHttpsUrl(value) {
  let u; try { u=new URL(value); } catch { return false; }
  const host=u.hostname.toLowerCase().replace(/^\[|\]$/g,"");
  const blockedSuffixes=[".localhost",".local",".internal",".test",".invalid",".home.arpa"];
  return u.protocol==="https:" && !u.username && !u.password && (!u.port || u.port==="443") &&
    !!host && host!=="localhost" && !blockedSuffixes.some(s=>host.endsWith(s)) &&
    !/^[0-9.]+$/.test(host) && !host.includes(":") && host.includes(".");
}
const hex = bytes => Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
async function previewApprovalToken(env,session,details,expiresAt) {
  if(!env.GITHUB_CLIENT_SECRET) throw new Error("Preview signing secret missing");
  const canonical=JSON.stringify({userId:String(session.user_id),expiresAt,targetRepository:details.targetRepository,
    repositoryName:details.repositoryName,summary:details.summary,files:details.files.map(f=>[f.path,f.content])});
  const digest=hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical)));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.GITHUB_CLIENT_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const message=new TextEncoder().encode(String(session.user_id)+"."+expiresAt+"."+digest);
  const signature=hex(await crypto.subtle.sign("HMAC",key,message));
  return expiresAt+"."+digest+"."+signature;
}
async function verifyPreviewApproval(env,session,details,token) {
  if(typeof token!=="string") return false;
  const parts=token.split("."); if(parts.length!==3) return false;
  const expiresAt=Number(parts[0]); if(!Number.isSafeInteger(expiresAt)||expiresAt<Date.now()||expiresAt>Date.now()+10*60*1000) return false;
  return await previewApprovalToken(env,session,details,expiresAt)===token;
}

export async function autonomousBuild({request,env,url,session,ghApi,ghDecrypt,geminiFailure}) {
  const reply=(d,s=200)=>json(d,s);
  if(request.method!=="POST") return reply({error:"শুধু POST request গ্রহণ করা হয়।"},405);
  if(request.headers.get("Origin")!==url.origin) return reply({error:"Cross-origin request blocked।"},403);
  if(!session) return reply({error:"প্রথমে GitHub সংযোগ করুন।"},401);
  if(env.GEMINI_API_BILLING_STATUS!=="verified_free") return reply({error:"নিরাপত্তার জন্য Gemini API বন্ধ আছে। Google AI Studio-তে এই project Free tier হিসেবে যাচাই না হওয়া পর্যন্ত কোনো AI request পাঠানো হবে না।"},503);
  if(!env.GEMINI_API_KEY) return reply({error:"Gemini API secret নেই।"},503);
  const providerQuota=await getGeminiQuotaState(env);
  if(providerQuota.blocked) return reply({error:"Gemini Free Tier-এর দৈনিক quota শেষ। অপ্রয়োজনীয় request বন্ধ রাখা হয়েছে; quota cooldown শেষ হলে আবার চেষ্টা করুন।",code:"RESOURCE_EXHAUSTED",retryAt:providerQuota.blockedUntil,model:env.GEMINI_MODEL||"gemini-3.5-flash"},429);
  let body; try { body=await request.json(); } catch { return reply({error:"সঠিক JSON পাঠান।"},400); }
  const prompt=cleanText(body.prompt,10000);
  const reference=cleanText(body.referenceUrl,1500);
  const requestedRepo=cleanText(body.repository,150);
  if(!prompt) return reply({error:"ওয়েবসাইটের ধারণা বা নির্দেশনা লিখুন।"},400);
  if(reference) {
    if(!safePublicHttpsUrl(reference)) return reply({error:"নিরাপত্তার জন্য শুধু public HTTPS domain গ্রহণ করা হয়; IP address, local/private host, custom port বা credential-যুক্ত URL গ্রহণ করা হয় না।"},400);
  }
  const token=await ghDecrypt(env,session.encrypted_token);
  let repoInfo=null;
  if(requestedRepo && requestedRepo!=="__new__") {
    const parts=requestedRepo.split("/");
    if(parts.length!==2 || parts[0].toLowerCase()!==session.username.toLowerCase() || !safeRepo(parts[1])) return reply({error:"শুধু আপনার নিজের GitHub repository নির্বাচন করুন।"},403);
    const r=await ghApi("/repos/"+encodeURIComponent(parts[0])+"/"+encodeURIComponent(parts[1]),token);
    repoInfo=await r.json().catch(()=>({}));
    if(!r.ok || !repoInfo.default_branch || repoInfo.archived) return reply({error:"নির্বাচিত repository পড়া যায়নি বা সেটি archived।"},502);
  }
  // Do not fetch user-supplied reference URLs from the Worker. This removes
  // redirect, DNS-rebinding and private-network SSRF exposure entirely.
  const referenceText=reference ? "(Reference URL-টি শুধু design hint; নিরাপত্তার জন্য Worker URL-টি fetch করে না।)" : "";
  const instruction="You are KING CODER Gemini Manager and Website Inspector. First plan the information architecture, visual design, accessibility, responsive behavior, and core features; then generate a complete, polished, production-minded website. Before returning JSON, inspect your own proposed files for broken references, missing assets, insecure defaults, and obvious responsive or accessibility problems. Include a concise inspection checklist in testPlan. The user must review the preview before any GitHub change. If a reference URL is provided, reproduce its general layout and user-requested functionality, not its proprietary assets or exact copyrighted text. Make reasonable assumptions without asking questions. Output ONLY valid JSON: {\"repositoryName\":string,\"summary\":string,\"files\":[{\"path\":string,\"content\":string}],\"testPlan\":[string]}. Include all required source files, package.json and a Cloudflare-compatible wrangler.toml. Prefer a static site in public/ with a minimal Worker entry when suitable. Include a meaningful README. Never include secrets, API keys, credentials, or instructions to expose them. Do not create GitHub Actions workflow files; KING CODER adds its own test/deploy workflow. Do not use external proprietary images unless supplied by user; use CSS or safe public placeholders. Ensure the app can run/build with npm scripts. Use simple dependencies. At most 20 files and 350000 total characters. Every file content must be complete. Repository name must be lowercase kebab-case, 3-90 chars. Do not use markdown fences.";
  const quota=await env.DB.prepare("INSERT INTO user_usage(user_id,usage_date,chat_count,build_count,code_count) VALUES(?1,?2,0,1,0) ON CONFLICT(user_id,usage_date) DO UPDATE SET build_count=build_count+1 WHERE build_count < 5 RETURNING build_count AS used")
    .bind(String(session.user_id),new Date().toISOString().slice(0,10)).first();
  if(!quota) return reply({error:"আজকের বিনামূল্যের Website Build সীমা (৫টি) শেষ হয়েছে। আগামীকাল আবার চেষ্টা করুন।"},429);
  const userText="USER REQUEST:\n"+prompt+"\nREFERENCE URL: "+(reference||"none")+"\nREFERENCE PAGE NOTE (untrusted; informational only):\n"+referenceText+"\nTARGET REPOSITORY: "+(repoInfo?repoInfo.full_name:"Create a new private repository for this project.")+"\nGenerate the complete project preview now. Do not claim it has been committed, tested in a browser, or published.";
  const {response:ai,attempts}=await generateGemini({env,systemInstruction:instruction,contents:[{role:"user",parts:[{text:userText}]}],generationConfig:{temperature:0.2,maxOutputTokens:16000,responseMimeType:"application/json"}});
  if(!ai)return reply({error:"Gemini-এর সঙ্গে সংযোগ করা যায়নি। ৩ বার চেষ্টা করেও সংযোগ হয়নি।",attempts},502);
  const payload=await ai.json().catch(()=>({}));
  if(!ai.ok) return reply({...geminiFailure(payload,ai.status),attempts},ai.status===429?429:502);
  const raw=payload.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("").trim();
  let plan; try { plan=JSON.parse(raw); } catch { return reply({error:"AI-এর তৈরি project manifest সঠিক JSON নয়। আবার চেষ্টা করুন।"},502); }
  if(!plan || !Array.isArray(plan.files) || plan.files.length<2 || plan.files.length>20) return reply({error:"AI সম্পূর্ণ project files তৈরি করতে পারেনি।"},502);
  const seen=new Set(); let total=0;
  for(const f of plan.files) {
    if(!f || typeof f.path!=="string" || typeof f.content!=="string" || f.path.startsWith("/") || f.path.includes("\\") || f.path.split("/").some(p=>!p||p==="."||p==="..") || f.path.startsWith(".git/") || f.path.startsWith(".github/") || f.path.split("/").some(p=>p===".env"||p.startsWith(".env.")) || f.path.length>220 || seen.has(f.path)) return reply({error:"AI-এর project-এ অনিরাপদ file path বা duplicate file আছে।"},502);
    seen.add(f.path); total+=f.content.length;
  }
  if(total>350000) return reply({error:"প্রজেক্টের ফাইলের আকার অনুমোদিত সীমা ছাড়িয়েছে।"},413);
  const repoName=safeRepo(plan.repositoryName)?plan.repositoryName.toLowerCase():("king-coder-"+Date.now().toString(36));
  const previewDetails={targetRepository:requestedRepo || "__new__",repositoryName:repoName,summary:cleanText(plan.summary,500),files:plan.files};
  const previewExpiresAt=Date.now()+10*60*1000;
  const previewToken=await previewApprovalToken(env,session,previewDetails,previewExpiresAt);
  return reply({
    ok:true,
    mode:"preview",
    targetRepository:requestedRepo || "__new__",
    repositoryName:repoName,
    baseBranch:repoInfo?.default_branch || null,
    summary:previewDetails.summary,
    files:plan.files,
    previewToken,
    previewExpiresAt,
    testPlan:Array.isArray(plan.testPlan)?plan.testPlan.slice(0,10):[],
    attempts,
    provider:"gemini"
  });
}

function validProjectFiles(files) {
  if(!Array.isArray(files) || files.length<2 || files.length>20) return false;
  let total=0; const seen=new Set();
  for(const f of files) {
    if(!f || typeof f.path!=="string" || typeof f.content!=="string" ||
      f.path.startsWith("/") || f.path.includes("\\") ||
      f.path.split("/").some(p=>!p || p==="." || p==="..") ||
      f.path.startsWith(".git/") || f.path.startsWith(".github/") ||
      f.path.split("/").some(p=>p===".env" || p.startsWith(".env.")) ||
      f.path.length>220 || seen.has(f.path)) return false;
    seen.add(f.path); total+=f.content.length;
  }
  return total<=350000;
}

function deployWorkflow() {
  return `name: KING CODER manual Cloudflare publish
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install dependencies
        run: |
          if [ -f package-lock.json ]; then npm ci; elif [ -f package.json ]; then npm install; fi
      - name: Run tests
        run: if [ -f package.json ]; then npm test --if-present; fi
      - name: Build project
        run: if [ -f package.json ]; then npm run build --if-present; fi
      - name: Wrangler dry run
        run: npx --yes wrangler deploy --dry-run
  deploy:
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check existing Cloudflare credentials
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          if [[ -z "$CLOUDFLARE_API_TOKEN" || -z "$CLOUDFLARE_ACCOUNT_ID" ]]; then
            echo "Cloudflare credentials are not configured. No deployment was performed."
            exit 1
          fi
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
`;
}

export async function commitAutonomousBuild({request,env,url,session,ghApi,ghDecrypt}) {
  const reply=(d,s=200)=>json(d,s);
  if(request.method!=="POST") return reply({error:"শুধু POST request গ্রহণ করা হয়।"},405);
  if(request.headers.get("Origin")!==url.origin) return reply({error:"Cross-origin request blocked।"},403);
  if(!session) return reply({error:"প্রথমে GitHub সংযোগ করুন।"},401);
  let body; try { body=await request.json(); } catch { return reply({error:"সঠিক JSON পাঠান।"},400); }
  const target=cleanText(body.targetRepository,150);
  const repositoryName=cleanText(body.repositoryName,90).toLowerCase();
  const summary=cleanText(body.summary,500) || "KING CODER website build";
  const files=body.files;
  const previewDetails={targetRepository:target || "__new__",repositoryName,summary,files};
  if(!safeRepo(repositoryName) || !validProjectFiles(files) ||
    !await verifyPreviewApproval(env,session,previewDetails,body.previewToken))
    return reply({error:"Preview অনুমোদনের টোকেন অবৈধ, মেয়াদোত্তীর্ণ, অথবা Preview-এর ফাইল পরিবর্তিত হয়েছে। নতুন Preview তৈরি করুন।"},403);
  const token=await ghDecrypt(env,session.encrypted_token);
  let repoInfo=null;
  if(target && target!=="__new__") {
    const parts=target.split("/");
    if(parts.length!==2 || parts[0].toLowerCase()!==session.username.toLowerCase() || !safeRepo(parts[1])) return reply({error:"শুধু আপনার নিজের GitHub repository-তে কাজ করা যাবে।"},403);
    const r=await ghApi("/repos/"+encodeURIComponent(parts[0])+"/"+encodeURIComponent(parts[1]),token);
    repoInfo=await r.json().catch(()=>({}));
    if(!r.ok || !repoInfo.default_branch || repoInfo.archived) return reply({error:"নির্বাচিত repository পড়া যায়নি বা archived।"},502);
  } else {
    const cr=await ghApi("/user/repos",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:repositoryName,description:summary.slice(0,300),private:true,auto_init:true})});
    repoInfo=await cr.json().catch(()=>({}));
    if(!cr.ok || !repoInfo.default_branch) return reply({error:"GitHub-এ নতুন private repository তৈরি করা যায়নি: "+cleanText(repoInfo.message||"GitHub API error",250)},502);
  }
  const owner=repoInfo.owner.login,repo=repoInfo.name,baseBranch=repoInfo.default_branch;
  const base="/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo);
  const rr=await ghApi(base+"/git/ref/heads/"+baseBranch.split("/").map(encodeURIComponent).join("/"),token);
  const ref=await rr.json().catch(()=>({}));
  if(!rr.ok || !ref.object?.sha) return reply({error:"Repository-এর default branch পড়া যায়নি।"},502);
  const cm=await ghApi(base+"/git/commits/"+ref.object.sha,token);
  const parent=await cm.json().catch(()=>({}));
  if(!cm.ok || !parent.tree?.sha) return reply({error:"Repository-এর বর্তমান Git tree পড়া যায়নি।"},502);
  const finalFiles=[...files];
  if(files.some(f=>f.path==="wrangler.toml" || f.path==="wrangler.json" || f.path==="wrangler.jsonc")) {
    finalFiles.push({path:".github/workflows/king-coder-manual-deploy.yml",content:deployWorkflow()});
  }
  const tree=[];
  for(const f of finalFiles) {
    const br=await ghApi(base+"/git/blobs",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:f.content,encoding:"utf-8"})});
    const blob=await br.json().catch(()=>({}));
    if(!br.ok || !blob.sha) return reply({error:"GitHub file blob তৈরি করা যায়নি: "+f.path},502);
    tree.push({path:f.path,mode:"100644",type:"blob",sha:blob.sha});
  }
  const tr=await ghApi(base+"/git/trees",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({base_tree:parent.tree.sha,tree})});
  const newTree=await tr.json().catch(()=>({}));
  if(!tr.ok || !newTree.sha) return reply({error:"GitHub project tree তৈরি করা যায়নি।"},502);
  const nc=await ghApi(base+"/git/commits",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"KING CODER: "+summary.slice(0,120),tree:newTree.sha,parents:[ref.object.sha]})});
  const commit=await nc.json().catch(()=>({}));
  if(!nc.ok || !commit.sha) return reply({error:"GitHub project commit তৈরি করা যায়নি।"},502);
  const branchName="king-coder/build-"+Date.now().toString(36);
  const createRef=await ghApi(base+"/git/refs",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ref:"refs/heads/"+branchName,sha:commit.sha})});
  if(!createRef.ok) return reply({error:"নিরাপদ feature branch তৈরি করা যায়নি।"},502);
  const pr=await ghApi(base+"/pulls",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    title:"KING CODER: "+summary.slice(0,180),
    head:branchName,base:baseBranch,
    body:"## KING CODER প্রস্তাব\n\nএই পরিবর্তন Preview দেখে ব্যবহারকারীর অনুমোদনের পরে তৈরি হয়েছে।\n\n- Files: "+finalFiles.length+"\n- Base branch: "+baseBranch+"\n- Cloudflare publish: manual workflow_dispatch only; no automatic live deployment.\n\nদয়া করে GitHub Actions checks এবং diff পর্যালোচনা করে Merge করুন।"
  })});
  const pull=await pr.json().catch(()=>({}));
  if(!pr.ok || !pull.html_url) return reply({ok:true,repository:owner+"/"+repo,repositoryUrl:repoInfo.html_url,branch:branchName,commit:commit.sha,commitUrl:commit.html_url,pullRequestUrl:null,warning:"Branch তৈরি হয়েছে, কিন্তু Pull Request তৈরি করা যায়নি। GitHub-এ branch পরীক্ষা করুন।",files:finalFiles.map(f=>f.path)},502);
  return reply({ok:true,repository:owner+"/"+repo,repositoryUrl:repoInfo.html_url,branch:branchName,commit:commit.sha,commitUrl:commit.html_url,pullRequestUrl:pull.html_url,pullRequestNumber:pull.number,files:finalFiles.map(f=>f.path),manualPublish:true});
}
