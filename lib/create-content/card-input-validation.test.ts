import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cardStorage = await readFile(
  new URL("./card-storage.ts", import.meta.url),
  "utf8",
);

test("manual card saves validate renderer fit before reading or writing storage", () => {
  const validationIndex = cardStorage.indexOf(
    "activeText = await normalizeAndValidateCreateContentText",
  );
  const storageReadIndex = cardStorage.indexOf(
    "getCreateContentCardRowForOwner({",
  );

  assert.ok(validationIndex >= 0);
  assert.ok(storageReadIndex >= 0);
  assert.ok(
    validationIndex < storageReadIndex,
    "renderer-fit validation must reject invalid manual text before any card storage work",
  );
  assert.match(
    cardStorage,
    /CreateContentTextValidationError[\s\S]*CreateContentCardStorageError\(error\.message, 400\)/,
  );
});
