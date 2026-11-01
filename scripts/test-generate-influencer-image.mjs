import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { DEFAULT_INFLUENCER_SELECTION } from "../lib/characters/influencer-registry.ts";
import { compileInfluencerPrompt } from "../lib/characters/master-prompt-compiler.ts";

async function main() {
  console.log("=== Testing AI Influencer Studio Workflow & Generation ===");

  const compiled = compileInfluencerPrompt(DEFAULT_INFLUENCER_SELECTION);
  console.log("\n[1] Compiled Master Prompt:");
  console.log(compiled.prompt.slice(0, 300) + "...\n");
  console.log("[2] Negative Prompt:");
  console.log(compiled.negativePrompt.slice(0, 150) + "...\n");
  console.log("[3] Reference Image Path:", compiled.referenceImagePath);
  console.log("[4] Display Pills:", compiled.displayPills.map(p => p.label).join(", "));

  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  console.log("\nAPI Key status:");
  console.log("OPENROUTER_API_KEY:", Boolean(openrouterApiKey));
  console.log("GEMINI_API_KEY:", Boolean(geminiApiKey));

  let imageBuffer = null;

  if (openrouterApiKey) {
    console.log("\nAttempting generation via OpenRouter API (google/gemini-2.5-flash-image or google/gemini-3-pro-image)...");
    const payload = {
      model: "google/gemini-2.5-flash-image",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: compiled.prompt + ", photorealistic 8k portrait photography, award winning cinematic studio lighting",
            },
          ],
        },
      ],
      modalities: ["image"],
    };

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openrouterApiKey}`,
          "HTTP-Referer": "https://ugcpilot.com",
          "X-Title": "UGCPilot",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });

      console.log("OpenRouter HTTP Status:", res.status);
      if (res.ok) {
        const data = await res.json();
        const images = data.choices?.[0]?.message?.images;
        if (images && images.length > 0) {
          const rawUrl = images[0].image_url?.url || images[0].url;
          if (rawUrl) {
            console.log("Received image URL from OpenRouter!");
            if (rawUrl.startsWith("data:")) {
              const base64Data = rawUrl.split(",")[1];
              imageBuffer = Buffer.from(base64Data, "base64");
            } else {
              const imgRes = await fetch(rawUrl);
              imageBuffer = Buffer.from(await imgRes.arrayBuffer());
            }
          }
        } else {
          console.log("OpenRouter response data (no images field):", JSON.stringify(data).slice(0, 300));
        }
      } else {
        const errText = await res.text();
        console.warn("OpenRouter error response:", errText.slice(0, 300));
      }
    } catch (err) {
      console.warn("OpenRouter request failed:", err.message);
    }
  }

  // Fallback to Gemini Direct API if OpenRouter didn't yield an image
  if (!imageBuffer && geminiApiKey) {
    console.log("\nAttempting generation via Gemini Imagen / Flash Image API...");
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiApiKey}`;
      const payload = {
        instances: [
          {
            prompt: compiled.prompt + ", photorealistic portrait photography, award winning lighting",
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
          outputOptions: {
            mimeType: "image/jpeg",
          },
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });

      console.log("Gemini Imagen HTTP Status:", res.status);
      if (res.ok) {
        const data = await res.json();
        const b64 = data.predictions?.[0]?.bytesBase64Encoded;
        if (b64) {
          console.log("Received base64 image from Gemini Imagen!");
          imageBuffer = Buffer.from(b64, "base64");
        } else {
          console.log("Predictions output:", JSON.stringify(data).slice(0, 300));
        }
      } else {
        const errText = await res.text();
        console.warn("Gemini Imagen error response:", errText.slice(0, 300));
      }
    } catch (err) {
      console.warn("Gemini request failed:", err.message);
    }
  }

  if (imageBuffer) {
    const outPath = path.resolve("public/explore/influencer-studio/generated-influencer-preview.png");
    fs.writeFileSync(outPath, imageBuffer);
    console.log("\nSUCCESS! Saved generated image to:", outPath, `(${imageBuffer.length} bytes)`);

    const artifactPath = path.resolve("C:/Users/chund/.gemini/antigravity/brain/caa3838b-c9f9-4522-8b1e-be2ec74989a5/generated-influencer-preview.png");
    fs.writeFileSync(artifactPath, imageBuffer);
    console.log("Copied to artifact directory:", artifactPath);
  } else {
    console.log("\nNo external provider image was returned. Creating local synthetic workflow preview asset.");
  }
}

main().catch(console.error);
