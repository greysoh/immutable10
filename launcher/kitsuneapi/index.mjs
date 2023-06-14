import { runAndExecuteBash } from "../libs/runAndExecuteBashScript.mjs";
import { getUSBDevices } from "../libs/getUSBDevices.mjs";

// @deno-types="npm:@types/express@4.17.15"
import express, { request } from "npm:express@4.18.2";
import { stringify } from "https://deno.land/x/xml@2.1.1/mod.ts";
import { exists } from "https://deno.land/std@0.191.0/fs/mod.ts";

export function init() {
  console.log("Initializing...");

  const app = express();
  app.use(express.json());

  app.get("/api/v1/type", (_req, res) => {
    res.send({
      success: true,
      type: "immutable10-launcher/kitsuneapi",
    });
  });

  app.post("/api/v1/usb/refresh", async(_req, res) => {
    const usbDevicesRaw = await getUSBDevices();

    const usbDevices = usbDevicesRaw.filter((i) => !i.name.includes("hub"));
    const usbDevicesInXMLFormat = {
      hostdev: usbDevices.map((i) => {
        return {
          "@mode": "subsystem",
          "@type": "usb",
          "@managed": "yes",

          source: {
            vendor: {
              "@id": `0x${i.usbID.vendorID}`,
            },
            product: {
              "@id": `0x${i.usbID.deviceID}`,
            },
          },
        };
      }),
    };

    for (const device of usbDevicesInXMLFormat.hostdev) {
      await Deno.writeTextFile(
        "/tmp/usb.xml",
        stringify({
          hostdev: device,
        })
      );

      await runAndExecuteBash(
        "#!/bin/bash\nvirsh attach-device Immutable10VM --file /tmp/usb.xml"
      );
    }

    res.send({
      success: true
    })
  });

  app.post("/api/v1/immutability/set", async(req, res) => {
    if (!req.body.state) return res.status(400).send({
      error: "State not set"
    });
    
    if (req.body.state == "unlock") {
      try {
        await Deno.writeTextFile("/tmp/enableWriteSaving", "");
      } catch (_e) {
        // FIXME: I don't know the right status code for this situation.
        return res.status(400).send({
          error: "Immutability is already unlocked! (or internal server error)"
        });
      }
    } else if (req.body.state == "lock") {
      try {
        await Deno.remove("/tmp/enableWriteSaving");
      } catch (_e) {
        return res.status(400).send({
          error: "Immutability is not unlocked! (or internal server error)"
        });
      }
    }

    res.send({
      success: true
    });
  });

  // I can haz immutability?
  app.get("/api/v1/immutability", async(_req, res) => {
    return res.send({
      success: true,
      state: await exists("/tmp/enableWriteSaving") ? "unlocked" : "locked"
    });
  });

  app.listen(8000);
}
