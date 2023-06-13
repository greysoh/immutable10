import { init } from "../kitsuneapi/index.mjs";
import { getVirtNetworkDevices } from "./getNetworkDevices.mjs";

export async function initializeNetworkAPI() {
  console.log("Starting Kitsune API...");
  console.log(" - INIT TASK: Starting 'hello' request loop...");
  const virtNetDevices = await getVirtNetworkDevices();

  async function trySpamLoop() {
    for (const device of virtNetDevices) {
      try {
        const abortController = new AbortController();
        setTimeout(() => abortController.abort(), 1000);

        await fetch(`http://${device.ipAddress.replace("/24", "")}/api/v1/hello`, {
          signal: abortController.signal
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
}