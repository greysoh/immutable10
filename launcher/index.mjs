import { getVirtNetworkDevices } from "./libs/getNetworkDevices.mjs";
import { waitIncludingKeyPress } from "./libs/waitkeypress.mjs";
import { ezPatchVBIOS } from "./diags/ezpatchVBIOS/index.js";
import axiod from "https://deno.land/x/axiod@0.26.2/mod.ts";
import { choiceMenu } from "./libs/textmode.mjs";
import { installer } from "./install/index.mjs";
import { init } from "./plusapi/index.mjs";
import { start } from "./start/index.mjs";
import { verInfo } from "./ver.mjs";

console.log(`Immutable10 Launcher ${verInfo.ver} ("${verInfo.codename}")`)
if (verInfo.experimental) console.log("This is EXPERIMENTAL. Your computer may catch on fire, if you use this build. Thanks!");

if (Deno.args[0]) {
  switch (Deno.args[0]) {
    case "install": {
      await installer();

      break;
    }

    case "debug-net": {
      console.log("Starting networking extensions...");
      console.log(" - INIT TASK: Starting 'hello' request loop...");
      const virtNetDevices = await getVirtNetworkDevices();
    
      async function trySpamLoop() {
        for (const device of virtNetDevices) {
          try {
            // FIXME: Using a knockoff of axios is really overkill. Possibly migrate this to 
            // using the fetch API soon? thank
            await axiod.get(`http://${device.ipAddress.replace("/24", "")}/api/v1/hello`, {
              timeout: 1000
            });
          } catch (_e) {
            //
          }
        }
        
        setTimeout(trySpamLoop, 5000);
      }
    
      trySpamLoop();
    
      console.log(" - INIT TASK: Starting web API server...");
      init();

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