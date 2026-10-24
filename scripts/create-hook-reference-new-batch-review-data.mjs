import { readFileSync } from "node:fs";
import { atomicJsonSync } from "./reference-text-atomic-write.mjs";

// Creator captions checked against first/intermediate/final source frames.
// Graphic logos remain in the video; do not invent brand names as caption text.
const captions = {
  "New folder": "my new obsession: a\ngame where you go\nthrough a fake phone to\nfind a missing girl 🤫",
  "New folder (2)": "I found a game where I\nneed to stalk a girl's cell\nphone to find out what\nhappened With her",
  "New folder (3)": "wait...I think Draco is\nOBSESSED with me?!",
  "New folder (4)": "My sister is\nactually nuts why\nis this her wedding\ninvitation 😭😭😭",
  "New folder (5)": "POV: you gave a chance to\nthe IT guy and he sent this...\nlike wtf 😭",
  "New folder (6)": "ive spent 3HOURS book\nshopping and i just found\nthis now... like wtf 😭",
  "New folder (7)": "BRUH 💀 i just found out\nhow my little brother studies\nfor exams 😭",
  "New folder (8)": "BRUH 💀 3 YEARS OF\nSTUDYING AND I ONLY\nJUST FOUND THIS...",
  "New folder (9)": "WTF did i just find in my\nLAST YEAR OF UNI 😭",
  "New folder (10)": "WTF 😭 i just found out\nhow my sister studies for her\nexams... 💀",
  "New folder (11)": "i can do WHAT in london??? 💀💀",
  "New folder (12)": "italian girls are you OKAY???",
  "New folder (13)": "paris girls are you OKAY???",
  "New folder (14)": "uhmmm you're telling me i've been cooking for 3\nYEARS and NOW i find this????",
  "New folder (15)": "Been cooking for 5+ years and NOW i find this??",
  "New folder (16)": "3 years saving tiktok\nrecipes and NOW i\nfind this? 💀",
  "New folder (17)": "a girl in my class just showed\nme what she uses to study 😭",
  "New folder (18)": null,
  "New folder (19)": null,
  "New folder (20)": "= GOATED LEADS",
  "New folder (21)": "I've literally been shopping on amazon for 5\nYEARS and NOW i find this???💀",
  "New folder (22)": "No way I've been shopping on amazon for 4\nYEARS and NOW i find this 💀💀💀",
};
const release = JSON.parse(readFileSync("worker/src/lib/explore-hook-reference-new-batch-release.json", "utf8"));
const catalog = JSON.parse(readFileSync("lib/explore/reference-text-catalog.json", "utf8"));
if (Object.keys(captions).length !== release.items.length) throw new Error("Review must cover every staged reference.");
const items = release.items.map(item => {
  const source = catalog.items.find(text => text.referenceId === item.id && text.slideId === null);
  if (!source || source.sourceSha256 !== item.videoSha256 || !Object.hasOwn(captions, item.sourceFolder)) throw new Error(`Review source mismatch: ${item.sourceFolder}`);
  const text = captions[item.sourceFolder];
  return { referenceId: item.id, slideId: null, sourceSha256: source.sourceSha256,
    status: text === null ? "no_text" : "ready",
    blocks: text === null ? [] : [{ text, startMs: 0, endMs: Math.floor(item.durationSeconds * 1000) }],
    notes: text === null ? "Visually reviewed source frames: graphic logo formula only, with no remixable caption copy. Do not invent words from logos."
      : "Creator-added captions visually checked against sampled source frames, including the final frame. Incidental scenery and graphic logos excluded. Source timestamps sampled up to 4fps; boundaries approximate.",
  };
});
atomicJsonSync(".tmp/hook-new-batch/review/reviewed.json", { items });
console.log(JSON.stringify({ reviewed: items.length, ready: items.filter(item => item.status === "ready").length, noText: items.filter(item => item.status === "no_text").length }));
