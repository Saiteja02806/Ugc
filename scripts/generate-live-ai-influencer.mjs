import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import path from "node:path";

const prompt = `Full-body standing studio portrait photograph of a 25-year-old female influencer, entire human figure visible from head to toe in vertical 9:16 frame, centered standing pose on clean seamless light-gray studio backdrop. Feminine facial bone structure, approachable warm smile, chin-length blunt black bob haircut with textured bangs, warm olive skin tone with authentic unretouched micro-pores. Athletic toned build, sculpted shoulders, wearing a modern stylish activewear tracksuit (petrol teal zip jacket and leggings) and clean white sneakers. Sleek minimalist matte-black over-ear headphones resting around her neck. Shot on 50mm full-frame lens, commercial fashion studio lighting, hyper-realistic raw photo, sharp head-to-toe focus, feet fully visible.`;

async function main() {
  console.log("Generating AI Influencer image via OpenAI DALL-E 3 (1024x1792)...");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1792",
      quality: "hd",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI Error:", response.status, errText);
    process.exit(1);
  }

  const data = await response.json();
  const b64 = data.data[0].b64_json;
  const buffer = Buffer.from(b64, "base64");

  const outPublic = path.resolve("public/explore/influencer-studio/generated-influencer-live.png");
  fs.writeFileSync(outPublic, buffer);
  console.log("Saved to public:", outPublic);

  const artifactDir = "C:\\Users\\chund\\.gemini\\antigravity\\brain\\caa3838b-c9f9-4522-8b1e-be2ec74989a5";
  const outArtifact = path.join(artifactDir, "generated-ai-character.png");
  fs.writeFileSync(outArtifact, buffer);
  console.log("Saved to artifact:", outArtifact);
}

main().catch(console.error);
