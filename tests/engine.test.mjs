// Engine invariants. Runs with zero dependencies: `npm test` (node --test).
import test from "node:test";
import assert from "node:assert/strict";
import { evalExpr, sigOf, genPuzzle, levelOpts } from "../src/engine.js";

test("standard operator precedence, integer results", () => {
  assert.equal(evalExpr([2, "+", 3, "×", 4]), 14);
  assert.equal(evalExpr([20, "÷", 4, "-", 1]), 4);
  assert.equal(evalExpr([10, "-", 2, "×", 3]), 4);
  assert.equal(evalExpr([7]), 7);
  assert.ok(Number.isNaN(evalExpr([7, "+"])));        // incomplete
});

test("commutative solutions dedupe to one signature", () => {
  assert.equal(sigOf([8, 12], ["+"]), sigOf([12, 8], ["+"]));
  assert.equal(sigOf([2, 3, 12], ["×", "÷"]), sigOf([12, 3, 2], ["÷", "×"]));
});

test("320 generated puzzles across the difficulty curve are valid & solvable", () => {
  for (const lv of [1, 2, 3, 5, 8, 14, 20, 30]) {
    for (let s = 0; s < 40; s++) {
      const p = genPuzzle(1000 + lv * 777 + s, levelOpts(lv));
      assert.ok(p.solutions.length >= p.required, `too few solutions lv${lv} seed${s}`);
      const sol = [...p.solutions].sort((a, b) => a.count - b.count)[0];
      assert.equal(evalExpr(sol.tokens), p.target, `target unreachable lv${lv} seed${s}`);
      assert.equal(sol.tokens.length % 2, 1, `bad token shape lv${lv} seed${s}`);
      assert.ok(p.target >= 0 && Number.isInteger(p.target), `non-int target lv${lv} seed${s}`);
    }
  }
});

test("generation is deterministic per seed", () => {
  const a = genPuzzle(4242, levelOpts(5));
  const b = genPuzzle(4242, levelOpts(5));
  assert.deepEqual(a.pool, b.pool);
  assert.equal(a.target, b.target);
});
