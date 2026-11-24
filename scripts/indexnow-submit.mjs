import fs from "node:fs";
import path from "node:path";

const key = "a7c3e91b4d2f48e0b6c15a9d7e3f20c8";
const host = "vidmake.io";
const root = path.resolve(import.meta.dirname, "..");
const keyFile = path.join(root, "public", `${key}.txt`);
const stored = fs.readFileSync(keyFile, "utf8").trim();
if (stored !== key) throw new Error("IndexNow key file does not match the script key.");

const pagePaths = JSON.parse(fs.readFileSync(path.join(root, "lib/marketing/public-page-paths.json"), "utf8"));
const urlList = pagePaths.map((pagePath) => new URL(pagePath, `https://${host}`).href);
const body = {
  host,
  key,
  keyLocation: `https://${host}/${key}.txt`,
  urlList,
};

const submit = process.argv.includes("--submit");
if (!submit) {
  console.log(`IndexNow dry run: ${urlList.length} URLs for ${host}. Pass --submit with INDEXNOW_SUBMIT=1 after a deploy.`);
  console.log(body.keyLocation);
  process.exit(0);
}

if (process.env.INDEXNOW_SUBMIT !== "1") {
  console.error("Refusing to ping IndexNow. Set INDEXNOW_SUBMIT=1 and pass --submit.");
  process.exit(2);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
console.log(`IndexNow responded ${response.status}`);
if (!response.ok) {
  console.error(await response.text());
  process.exit(1);
}
