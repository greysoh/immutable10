// deno-lint-ignore-file
// Needed because I need asynchronous promise executors
import { readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";

export function waitIncludingKeyPress(t) {
  let hasResolved = false;

  return new Promise(async(resolve) => {
    async function deathThread() {
      await new Promise((i) => setTimeout(i, t));
      
      hasResolved = true;
      return resolve(false);
    }

    async function keyThread() {
      for await (const _keypress of readKeypress()) {
        if (hasResolved) return;
        return resolve(true);
      }
    }

    keyThread();
    await deathThread();
  });
}