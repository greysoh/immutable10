import { installer } from "./install/index.mjs";
import { verInfo } from "./ver.mjs";

console.log(`Immutable10 Launcher ${verInfo.ver} ("${verInfo.codename}")`)
if (verInfo.experimental) console.log("This is EXPERIMENTAL. Remember, FAFO!");

if (Deno.args[0]) {
  switch (Deno.args[0]) {
    case "install": {
      console.log("Immutable10 Launcher proudly written in JavaScript");

      await installer();
    }
  }
}