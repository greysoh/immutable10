import { waitIncludingKeyPress } from "./libs/waitkeypress.mjs";
import { installer } from "./install/index.mjs";
import { choiceMenu } from "./libs/textmode.mjs";
import { start } from "./start/index.mjs";
import { verInfo } from "./ver.mjs";
import { ezPatchVBIOS } from "./diags/ezpatchVBIOS/index.js";

console.log(`Immutable10 Launcher ${verInfo.ver} ("${verInfo.codename}")`)
if (verInfo.experimental) console.log("This is EXPERIMENTAL. Your computer may catch on fire, if you use this build. Thanks!");

if (Deno.args[0]) {
  switch (Deno.args[0]) {
    case "install": {
      await installer();

      break;
    }

    case "vbios": {
      await ezPatchVBIOS();

      break;
    }

    case "start": {
      await start();

      break;
    }

    default: {
      console.log("No arguments specified!");

      break;
    }
  }
} else {
  console.log("Hit any key to skip autoboot: 1");
  const keyPressCheck = await waitIncludingKeyPress(1000);

  if (!keyPressCheck) {
    console.log("Hit any key to skip autoboot: 0");
    
    try {
      await start();
    } catch (e) {
      console.log(e);
    }

    Deno.exit(0);
  }

  const optMenu = choiceMenu("Choose an option:", "Diagnostics...", "Install");

  switch (optMenu) {
    default: {
      console.log("FIXME: This shouldn't appear!");
      break;
    }

    case 1: {
      const diagsOptMenu = choiceMenu("Diagnostics...", "EZPatch VBIOS");

      switch (diagsOptMenu) {
        default: {
          console.log("FIXME: This shouldn't appear!");
          break;
        }

        case 1: {
          await ezPatchVBIOS();

          break;
        }
      }

      break;
    }

    case 2: {
      await installer();

      break;
    }
  }
}

// waitIncludingKeyPress abuses Deno quite a bit, so exiting sometimes
// doesn't work naturally. Therefore, we would need to force an exit.
// So,
Deno.exit(0);

// The technical details on *why* it kinda breaks natural exiting is
// that, if we don't press a key (ex. we don't skip autoboot), it is
// still waiting for a key press in that iterator loop, which would
// sometimes never occur. The fix to that problem is to force an
// exit, which would close all handles(? It stops the script, that's
// all I know), probably resolve some promises forcefully, and exit.