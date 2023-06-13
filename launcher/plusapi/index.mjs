import { getUSBDevices } from "../libs/getUSBDevices.mjs";

// @deno-types="npm:@types/express@4.17.15"
import express from "npm:express@4.18.2";
import { stringify } from "https://deno.land/x/xml@2.1.1/mod.ts";

export function init() {
  console.log("Initializing...");

  const app = express();
  app.use(express.json());

  app.get("/api/v1/type", (_req, res) => {
    res.send({
      success: true,
      type: "immutable10-launcher/plusapi",
    });
  });

  app.post("/api/v1/usb/refresh", async (_req, res) => {
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
        "#!/bin/bash\nvirsh attach-device Immutable10VM --file /tmp/usb.xml --config"
      );
    }

    res.send({
      success: true
    })
  });

  app.listen(8000);
}
