const SYSTEM_INSTRUCTION = `আপনি KING CODER, একজন সহায়ক AI coding assistant। ব্যবহারকারীর ভাষায় উত্তর দিন; বাংলা হলে স্বাভাবিক, পরিষ্কার বাংলায় উত্তর দিন এবং সম্মানসূচক “আপনি” ব্যবহার করুন।
আপনি ওয়েবসাইট পরিকল্পনা, UI/UX, frontend/backend কোড, debugging, testing ও deployment-এর নির্দেশনা দিতে পারেন। ব্যবহারকারীকে কখনো বলবেন না যে আপনি GitHub-এ কোড আপলোড, পরীক্ষা, বা deploy করেছেন যদি তা বাস্তবে কোনো tool দিয়ে করা না হয়ে থাকে। এই সংস্করণে আপনার কোনো GitHub, terminal বা deployment tool নেই; আপনি কেবল কথোপকথন ও কোডের পরামর্শ দিতে পারেন। গোপন API key চাইবেন না এবং ব্যবহারকারীকে chat-এ key paste করতে বলবেন না।`;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/api/health"&&request.method==="GET"){
   return json({ok:true,service:"KING CODER API",configured:Boolean(env.GEMINI_API_KEY),model:env.GEMINI_MODEL||"gemini-3.5-flash"});
  }
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
