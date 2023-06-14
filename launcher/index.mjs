// Libraries
import { waitIncludingKeyPress } from "./libs/waitkeypress.mjs";
import { choiceMenu } from "./libs/textmode.mjs";
import { verInfo } from "./ver.mjs";

// Options
import { initializeNetworkAPI } from "./libs/initNetworkAPI.mjs";
import { ezPatchVBIOS } from "./diags/ezpatchVBIOS/index.js";
import { installer } from "./install/index.mjs";
import { start } from "./start/index.mjs";
import { stop } from "./stop/index.mjs";

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

    case "stophook": {
      await stop();

      break;
    }

    default: {
      console.log("Invalid argument specifed!");
      console.log(" - debug-net: Manually initialize the Kitsune API.");
      console.log(" - stophook: Hook ran when the VM stops to run snapshots.");
      console.log(" - install: Configure the virtual machine.");
      console.log(" - vbios: Manually initialize automated VBIOS patching.");
      console.log(" - start: Forcefully start the virtual machine without a countdown.");
      
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

    // In case of emergencies
    while (true) {
      await new Promise((i) => setTimeout(i, 1000*1000));
    }
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