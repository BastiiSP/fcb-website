import assert from "node:assert/strict";
import test from "node:test";
import { assertBudget } from "./backup-b2-budget.mjs";

test("kostenloses Budget berücksichtigt Reserve und dreifache neue Daten", () => {
  assert.doesNotThrow(() => assertBudget(0, 100_000_000));
  assert.throws(() => assertBudget(7_600_000_000, 100_000_000));
  assert.throws(() => assertBudget(0, 100_000_001));
});
test("ungültige oder nicht exakt zählbare Speichergrößen werden abgelehnt", () => {
  for (const value of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "0"]) assert.throws(() => assertBudget(value, 1));
});
