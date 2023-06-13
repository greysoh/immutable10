import { stringify } from "https://deno.land/x/xml@2.1.1/mod.ts";

import { getUSBDevices } from "../libs/getUSBDevices.mjs";
import { initializeNetworkAPI } from "../libs/initNetworkAPI.mjs";
import { runAndExecuteBash } from "../libs/runAndExecuteBashScript.mjs";

export async function start() {
  console.log("Running VM USB enumeration...");
  const usbDevicesRaw = await getUSBDevices();
  console.log("Running USB passthrough...");

  // Exclude the hubs, because I don't want my computer to catch on fire.
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

  // Before you say this is stupid (which I agree), this isn't possible to do all at once:
  // https://stackoverflow.com/questions/70026744/can-i-attach-multiple-usb-devices-from-one-xml-file-to-vm-with-virsh

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

  console.log("Starting VM...");
  await runAndExecuteBash(`#!/bin/bash\nvirsh start Immutable10VM`);

  console.log("Starting networking extensions...");
  await initializeNetworkAPI();
}
