import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BUSINESS_CONTEXT_MODEL,
  DEFAULT_BUSINESS_CONTEXT_REASONING_EFFORT,
  getBusinessContextModelRequest,
} from "./model.ts";

const CONTEXT_MODEL_ENV = [
  "OPENAI_BUSINESS_CONTEXT_MODEL",
  "OPENAI_BUSINESS_CONTEXT_REASONING_EFFORT",
] as const;

test("Business Context defaults to Luna with medium reasoning and keeps legacy overrides compatible", () => {
  const original = new Map(
    CONTEXT_MODEL_ENV.map((name) => [name, process.env[name]]),
  );

  try {
    for (const name of CONTEXT_MODEL_ENV) delete process.env[name];

    assert.equal(DEFAULT_BUSINESS_CONTEXT_MODEL, "gpt-5.6-luna");
    assert.equal(DEFAULT_BUSINESS_CONTEXT_REASONING_EFFORT, "medium");
    assert.deepEqual(getBusinessContextModelRequest(), {
      model: "gpt-5.6-luna",
      reasoning_effort: "medium",
    });

    process.env.OPENAI_BUSINESS_CONTEXT_MODEL = "gpt-5.6-luna";
    process.env.OPENAI_BUSINESS_CONTEXT_REASONING_EFFORT = "HIGH";
    assert.deepEqual(getBusinessContextModelRequest(), {
      model: "gpt-5.6-luna",
      reasoning_effort: "high",
    });

    process.env.OPENAI_BUSINESS_CONTEXT_MODEL = "gpt-4o-mini";
    process.env.OPENAI_BUSINESS_CONTEXT_REASONING_EFFORT = "not-a-supported-effort";
    assert.deepEqual(getBusinessContextModelRequest(), {
      model: "gpt-4o-mini",
      temperature: 0.2,
    });
  } finally {
    for (const name of CONTEXT_MODEL_ENV) {
      const value = original.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
