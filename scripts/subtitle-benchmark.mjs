/** Independent text/timing scoring against an explicitly human-reviewed reference. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function normalizeWord(word) {
  return word.normalize("NFKC").toLowerCase().replace(/[’‘]/gu, "'").replace(/[^\p{L}\p{N}']/gu, "").replace(/^'+|'+$/gu, "");
}

function distribution(values) {
  if (!values.length) return null;
  const ordered = values.map(Math.abs).sort((a, b) => a - b);
  const n = ordered.length;
  return { count: n, medianAbsoluteMs: n % 2 ? ordered[(n - 1) / 2] : (ordered[n / 2 - 1] + ordered[n / 2]) / 2,
    p95AbsoluteMs: ordered[Math.ceil(n * 0.95) - 1], maxAbsoluteMs: ordered[n - 1],
    meanSignedMs: values.reduce((a, b) => a + b, 0) / n };
}

export function scoreSubtitleBenchmark(prediction, reference) {
  if (reference.reviewStatus !== "human-checked" || !reference.reviewer?.trim() || !reference.checkedAt) {
    throw new Error("An explicitly human-checked reference is required; pending/model-generated times are not ground truth.");
  }
  if (!reference.sourceSha256 || prediction.sourceSha256 !== reference.sourceSha256) throw new Error("Source hashes must match.");
  if (!Number.isFinite(reference.durationMs) || reference.durationMs <= 0 || reference.durationMs > 120000 || !Number.isFinite(Date.parse(reference.checkedAt))) {
    throw new Error("Valid reference duration and review date required.");
  }
  const expected = reference.words, actual = prediction.words;
  if (!Array.isArray(expected) || !expected.length || !Array.isArray(actual)) throw new Error("Word arrays required.");
  for (const [kind, words] of [["reference", expected], ["prediction", actual]]) {
    let previousEnd = -1;
    for (const word of words) {
      if (typeof word.text !== "string" || !normalizeWord(word.text) || !Number.isFinite(word.startMs) || !Number.isFinite(word.endMs) ||
          word.startMs < previousEnd || word.endMs <= word.startMs || word.endMs > reference.durationMs) throw new Error(`Invalid ${kind} words/timings.`);
      previousEnd = word.endMs;
    }
  }
  const n = expected.length, m = actual.length;
  if (Math.max(n, m) > 2000) throw new Error("Evaluation is bounded to 2000 words.");
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const same = normalizeWord(expected[i - 1].text) === normalizeWord(actual[j - 1].text);
    dp[i][j] = Math.min(dp[i - 1][j - 1] + Number(!same), dp[i - 1][j] + 1, dp[i][j - 1] + 1);
  }
  let i = n, j = m, substitutions = 0, deletions = 0, insertions = 0;
  const matches = [], edits = [];
  while (i || j) {
    const same = i && j && normalizeWord(expected[i - 1].text) === normalizeWord(actual[j - 1].text);
    if (same && dp[i][j] === dp[i - 1][j - 1]) { matches.push({ referenceIndex: --i, predictionIndex: --j }); }
    else if (i && j && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions++; edits.push({ type: "substitution", reference: expected[--i].text, prediction: actual[--j].text });
    } else if (i && dp[i][j] === dp[i - 1][j] + 1) { deletions++; edits.push({ type: "deletion", reference: expected[--i].text }); }
    else { insertions++; edits.push({ type: "insertion", prediction: actual[--j].text }); }
  }
  const perWord = matches.reverse().map(({ referenceIndex, predictionIndex }) => ({ referenceIndex, predictionIndex,
    text: expected[referenceIndex].text, startErrorMs: actual[predictionIndex].startMs - expected[referenceIndex].startMs,
    endErrorMs: actual[predictionIndex].endMs - expected[referenceIndex].endMs }));
  const start = perWord.map(w => w.startErrorMs), end = perWord.map(w => w.endErrorMs);
  const result = { sourceSha256: reference.sourceSha256, reviewer: reference.reviewer, checkedAt: reference.checkedAt,
    transcription: { referenceWords: n, predictionWords: m, substitutions, deletions, insertions, wer: dp[n][m] / n, edits: edits.reverse() },
    timing: { matchedWords: matches.length, excludedReferenceWords: n - matches.length, excludedPredictionWords: m - matches.length,
      start: distribution(start), end: distribution(end), allBoundaries: distribution([...start, ...end]),
      signConvention: "Positive means the prediction is late; negative means early", perWord },
    matchingPolicy: "Minimum word edit distance; deterministic diagonal-first tie break. Timing includes only exact normalized word matches.",
    provisionalTolerance: { wer: 0, medianAbsoluteMs: 100, p95AbsoluteMs: 200 } };
  result.meetsProvisionalTolerance = result.transcription.wer === 0 && !!result.timing.allBoundaries &&
    result.timing.allBoundaries.medianAbsoluteMs <= 100 && result.timing.allBoundaries.p95AbsoluteMs <= 200;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [predictionPath, referencePath, outputPath] = process.argv.slice(2);
    if (!predictionPath || !referencePath || !outputPath) throw new Error("Usage: node scripts/subtitle-benchmark.mjs PREDICTION.json HUMAN_REFERENCE.json NEW_REPORT.json");
    const result = scoreSubtitleBenchmark(JSON.parse(await readFile(predictionPath, "utf8")), JSON.parse(await readFile(referencePath, "utf8")));
    await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify({ transcription: result.transcription, timing: result.timing.allBoundaries, meetsProvisionalTolerance: result.meetsProvisionalTolerance }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
