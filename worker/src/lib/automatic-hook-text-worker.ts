import { createHash } from "node:crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { runAutomaticHookText, type AutomaticHookTextPlan } from "./automatic-hook-text.js";

export async function generateAutomaticHookText(owner: string, plan: AutomaticHookTextPlan) {
  const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const payloadHash=createHash("sha256").update(JSON.stringify(plan)).digest("hex");
  return runAutomaticHookText(plan,{
    async claim() {
      const {data,error}=await db.rpc("explore_claim_text_remix",{p_user_id:owner,p_request_key:plan.requestKey,p_payload_hash:payloadHash,p_input:plan});
      if(error || !data || typeof data.claimed!=="boolean") throw new Error("Could not confirm the automatic text claim.");
      return data;
    },
    async read() {
      const {data,error}=await db.from("explore_text_remixes").select("status,output_json,payload_hash").eq("user_id",owner).eq("request_key",plan.requestKey).maybeSingle();
      if(error || data?.payload_hash!==payloadHash) throw new Error("Could not confirm the automatic text result.");
      return data ? {status:data.status,output:data.output_json} : null;
    },
    async generate() {
      const ai=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:60000});
      const completion=await ai.chat.completions.create({model:plan.model,max_completion_tokens:4000,
        ...(/^gpt-5/.test(plan.model)?{reasoning_effort:"medium" as const}:{temperature:.2}),
        messages:[{role:"system",content:plan.systemPrompt},{role:"user",content:plan.userPrompt}],
        response_format:{type:"json_schema",json_schema:{name:"automatic_hook_text",strict:true,schema:{type:"object",additionalProperties:false,
          properties:{blocks:{type:"array",items:{type:"string"}},heading:{type:"string"},body:{type:"string"}},required:["blocks","heading","body"]}}}});
      if(completion.choices[0]?.finish_reason!=="stop" || completion.choices[0]?.message.refusal) throw new Error("Automatic text was not completed.");
      return JSON.parse(completion.choices[0]?.message.content ?? "null");
    },
    async complete(output) {
      const {error}=await db.from("explore_text_remixes").update({status:"completed",output_json:output,updated_at:new Date().toISOString()}).eq("user_id",owner).eq("request_key",plan.requestKey).eq("status","pending").select("request_key").single();
      if(error) throw new Error("Could not confirm the saved automatic text.");
    },
    async fail() {
      const {error}=await db.from("explore_text_remixes").update({status:"failed",updated_at:new Date().toISOString()}).eq("user_id",owner).eq("request_key",plan.requestKey).eq("status","pending");
      if(error) throw new Error("Could not confirm the automatic text failure.");
    },
    wait:()=>new Promise(resolve=>setTimeout(resolve,2000)),
  });
}
