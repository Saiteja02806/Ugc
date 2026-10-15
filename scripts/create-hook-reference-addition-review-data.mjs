import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const review = {
  "New folder (3)": [["“bro rate my startup idea 💀🥀”"]],
  "New folder (4)": [["Part time job ❌\nColoring Books ✅"]],
  "New folder (5)": [["“I can’t get client” 😫", 0, 2400], ["“I can’t get client” 😫\n“Ok...let me show you how” 😎", 2400]],
  "New folder (6)": [["Wait...CHATGPT 6 Astra can do what? 🤡💀"]],
  "New folder (7)": [["SAY BYE BYE\nTO CLAUDE MAX 🥀🤪"]],
  "New folder (8)": [["grand\ntheft\nauto VI + YouTube\n= $678/day 🤑"]],
  "New folder (9)": [["pov: you’re dating an IT guy"]],
  "New folder (10)": [["4 YEARS of Amazon shopping and nobody told\nme about this!!! 👀"]],
  "New folder (11)": [["No way I’ve been shopping on Amazon for 4 YEARS\nand NOW I find this 💀💀💀"]],
  "New folder (12)": [["How tf is this LEGAL? 💀"]],
  "New folder (13)": [["I deleted Capcut after this 🤫"]],
  "New folder (14)": [["Why was I searching for\ntemplate on Tiktok when\nthis exists 😭😭😭"]],
  "New folder (17)": [["I think my sister has\nofficially lost her mind\nwhy is this her wedding\ninvitation??"]],
  "New folder (18)": [["someone tell me how this worksss 🥺"]],
  "New folder (19)": [["how life sounds like after your\nfriend shows you an app to\nlive translate and save\nmanhwa on your phone"]],
  "New folder (20)": [["Imagine a game where\nyou have to stalk a\nmissing girl’s phone to\nfind her"]],
  "New folder (21)": [["My sister is actually nuts\nwhy are these her\nwedding invites 😭"]],
  "New folder (22)": [["POV: ur alarm won’t turn\noff til u do 15 squats 😭😭😭"]],
  "New folder (26)": [["Travel Agents...\nare we cooked??", 0, 1867], ["Travel Agents...\nare we cooked??\nlook what I found... 😭😭", 1867]],
  "New folder (27)": [["You’re telling me I could’ve been\nwatching the Bible this whole\ntime???"]],
  "New folder (28)": [["How to put a Bible verse\non your lockscreen\n(It changes everyday)"]],
  "New folder (29)": [["10 years of using a male\ndesigned period app and\nnow I find this..."]],
  "New folder (30)": [["You realize you’ve been\nusing such basic period\napps & then find THIS!!!??"]],
  "New folder (31)": [["pov: you finally delete\nsnap"]],
  "New folder (32)": [["Not my MOMMM asking me to\nget this with her before I leave for\ncollege 😭🥰"]],
  "New folder (33)": [["My boyfriend changed my alarm so now I have\nto fly to turn it off 😭😭💔"]],
  "New folder (39)": [["20 years of cooking and I just\nfound this? 🙄😡😭"]],
  "New folder (43)": [["4 years at the gym and I just\nNOW find this?!?!"]],
  "New folder (46)": [["How TF is this legal\nIn CANVA 😡😤😭"]],
  "New folder (47)": [["imagine being scared\nof solo traveling\nwhen THIS exists 🤣💀"]],
  "New folder (48)": [["Girls in Seoul 🇰🇷 are WILD\n😂😭💔"]],
};

const release = JSON.parse(readFileSync("worker/src/lib/explore-hook-reference-addition-release.json", "utf8"));
const catalog = JSON.parse(readFileSync("lib/explore/reference-text-catalog.json", "utf8"));
const catalogById = new Map(catalog.items.map(item => [item.referenceId, item]));
if (Object.keys(review).length !== release.items.length) throw new Error("Every staged Hook needs a visual review entry.");

const items = release.items.map(item => {
  const source = catalogById.get(item.id), definitions = review[item.sourceFolder];
  if (!source || !definitions) throw new Error(`Missing review source: ${item.sourceFolder}`);
  const durationMs = Math.floor(item.durationSeconds * 1000);
  const blocks = definitions.map(([text, startMs = 0, endMs = durationMs], index) => ({
    text,
    startMs,
    endMs: index === definitions.length - 1 ? durationMs : endMs,
  }));
  if (blocks.some(block => !block.text || block.endMs <= block.startMs || block.endMs > durationMs)) throw new Error(`Invalid reviewed timing: ${item.sourceFolder}`);
  return {
    referenceId: item.id,
    slideId: null,
    sourceSha256: source.sourceSha256,
    status: "ready",
    blocks,
    notes: "Creator-added captions visually reviewed against sampled source frames; platform UI excluded. Timestamp boundaries are approximate to the sampled source frames.",
  };
});

const output = path.resolve(".tmp/hook-reference-addition-review/reviewed.json");
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ items }, null, 2) + "\n");
console.log(JSON.stringify({ output, reviewed: items.length }));
