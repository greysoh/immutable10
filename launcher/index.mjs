// Libraries
import { waitIncludingKeyPress } from "./libs/waitkeypress.mjs";
import { choiceMenu } from "./libs/textmode.mjs";
import { verInfo } from "./ver.mjs";

// Options
import { initializeNetworkAPI } from "./libs/initNetworkAPI.mjs";
import { ezPatchVBIOS } from "./diags/ezpatchVBIOS/index.js";
import { installer } from "./install/index.mjs";
import { start } from "./start/index.mjs";

console.log(`Immutable10 Launcher ${verInfo.ver} ("${verInfo.codename}")`)
if (verInfo.experimental) console.log("This is EXPERIMENTAL. Your computer may catch on fire, if you use this build. Thanks!");

if (Deno.args[0]) {
  switch (Deno.args[0]) {
    case "install": {
      await installer();

      break;
    }

    case "debug-net": {
      await initializeNetworkAPI();

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