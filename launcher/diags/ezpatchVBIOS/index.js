import { parse, stringify } from "https://deno.land/x/xml@2.1.1/mod.ts";

import { runAndExecuteBash } from "../../libs/runAndExecuteBashScript.mjs";
import { getEligibleIOMMUGroups } from "../../libs/getEligibleIOMMUGroups.mjs";
import { yesOrNo } from "../../libs/yesOrNo.mjs";

function dumpVBIOSCommands(pciIDs) {
  const cmdList = [];
  for (const id of pciIDs) {
    cmdList.push(`echo "Unlocking VBIOS for ID ${id}..."`);
    cmdList.push(`echo 1 | sudo tee /sys/bus/pci/devices/0000:${id}/rom`);
    cmdList.push(`echo "Dumping VBIOS for ID ${id}..."`);
    cmdList.push(`sudo sh -c 'cat /sys/bus/pci/devices/0000:${id}/rom > /tmp/${id}.rom'`);
    cmdList.push(`echo "Locking VBIOS for ID ${id}..."`);
    cmdList.push(`echo 0 | sudo tee /sys/bus/pci/devices/0000:${id}/rom`);
  }

  return cmdList.join("\n");
}

function doYOLOConvert(int, disableOffsetString) {
  const numToHex = int.toString(16);

  if (numToHex.length == 1 && !disableOffsetString) return `0${numToHex}`;
  return numToHex;
}

export async function ezPatchVBIOS() {
  const iommuGroups = await getEligibleIOMMUGroups();

  // You may argue that .find() may work better, but since we search an
  // inner array, that kinda falls apart.

  // So, a for loop is better, in this context. I don't care what you
  // say otherwise.
  console.log("Searching for GPU devices...");
  const activeGPUDevices = [];

  for (const group of iommuGroups) {
    for (const device of group) {
      if (device.pciType == "VGA compatible controller") {
        activeGPUDevices.push(device);
      }
    }
  }

  console.log("Eligible PCI devices:");

  // FIXME: This is probably not the best way to do this.
  // First, log all the devices:
  for (const device of activeGPUDevices) {
    console.log(" - %s %s: %s", device.pciId, device.pciType, device.pciName);
  }

  console.log("");

  // Then, ask the user if they would like to allow
  // modification to that GPU:
  for (const device of activeGPUDevices) {
    if (!yesOrNo(`Would you like to modify PCI ID '${device.pciId}'?`)) {
      activeGPUDevices.splice(activeGPUDevices.indexOf(device), 1);
    }
  }

  console.log("Dumping VBIOSes...");
  await runAndExecuteBash(
    `#!/bin/bash\n${dumpVBIOSCommands(activeGPUDevices.map((i) => i.pciId))}`,
    true
  );

  console.log("NOTICE: If any of the above operations fail, try enabling CSM in your BIOS.");

  // Finally, copy the VBIOSes locally. Doing this allows us to watch for changes, using SFTP.
  try {
    await Deno.mkdir("./VBIOS");
  } catch (_e) {
    //
  }

  for (const device of activeGPUDevices) {
    try {
      await Deno.copyFile("/tmp/" + device.pciId + ".rom", "./VBIOS/" + device.pciId + ".rom");
    } catch (e) {
      console.log(`ERROR: Copying failed on device ${device.pciId}. Aborting...`);
      console.log(" -", e);

      return;
    }
  }

  const vbiosDirWatch = Deno.watchFs("./VBIOS");
  console.log("Elevating to enable SSH...");
  await runAndExecuteBash("#!/bin/bash\nsudo true", true);

  const testEnableSSH = await runAndExecuteBash("#!/bin/bash\nsudo systemctl enable ssh");
  const sshEnableStr = new TextDecoder().decode(testEnableSSH);

  console.log("SSH has been enabled. You may connect via the SFTP protocol. (WinSCP, FileZilla, etc.)");
  console.log("The VBIOSes are in the VBIOS directory.");
  
  for await (const event of vbiosDirWatch) {
    for (const path of event.paths) console.log(`LOG: '${event.kind}' event occurred at path '${path}'.`);

    if (event.kind == "modify") {
      for (const path of event.paths) {
        const pathSplit = path.split("/");
        const lastItem = pathSplit[pathSplit.length-1];
        
        if (!lastItem.endsWith(".rom")) continue;
        const pciId = lastItem.split(".rom")[0];

        const foundElem = activeGPUDevices.find((i) => i.pciId == pciId);
        if (!foundElem) continue;

        activeGPUDevices[activeGPUDevices.indexOf(foundElem)].hasModdedUpdate = true;

        if (activeGPUDevices.every((i) => i.hasModdedUpdate)) {
          console.log("All VBIOSes have been updated! Exiting directory watching...");
          
          vbiosDirWatch.close();
          break;
        }
      }
    }
  }

  // If SSH has been already enabled, we skip this because it would be rude
  // to disable SSH if they're using it.

  if (sshEnableStr.includes("Created symlink")) {
    await runAndExecuteBash("#!/bin/bash\nsudo systemctl disable ssh");
    console.log("SSH has been disabled.");
  }

  console.log("Copying Virtual Machine XML...");

  const vmXMLRaw = await runAndExecuteBash("#!/bin/bash\nvirsh dumpxml Immutable10VM");
  const vmXML = new TextDecoder().decode(vmXMLRaw);

  console.log("Modifying XML...");
  const vmXMLParsed = parse(vmXML);
  delete vmXMLParsed.domain.devices.tpm;

  for (const pciDevice of vmXMLParsed.domain.devices.hostdev) {
    if (pciDevice["@type"] != "pci") continue;

    const sourceAddress = pciDevice.source.address;

    const pciBus = doYOLOConvert(sourceAddress["@bus"]);
    const pciSlot = doYOLOConvert(sourceAddress["@slot"]);
    const pciFunction = doYOLOConvert(sourceAddress["@function"], true);

    console.log(`dbg: ${pciBus}:${pciSlot}.${pciFunction}`);
    
    const deviceMatch = activeGPUDevices.find((i) => {
      const pciIdSplit = i.pciId.split(":");
      
      const gpuBus = pciIdSplit[0];
      const gpuSlot = pciIdSplit[1].split(".")[0];
      const gpuFunction = pciIdSplit[1].split(".")[1];

      if (pciBus == gpuBus && pciSlot == gpuSlot && pciFunction == gpuFunction) return true;
    });

    if (!deviceMatch) continue;
    const romDir = `/usr/share/vgabios/${deviceMatch.pciId}.rom`;

    vmXMLParsed.domain.devices.hostdev[vmXMLParsed.domain.devices.hostdev.indexOf(pciDevice)].rom = {
      "@file": romDir
    }
  }

  console.log("Writing XML...");
  await Deno.writeTextFile("/tmp/Immutable10VM.xml", stringify(vmXMLParsed));
  
  await runAndExecuteBash(
    `#!/bin/bash
    set -x
    sudo mkdir /usr/share/vgabios
    sudo cp -r ~/VBIOS/* /usr/share/vgabios
    sudo chmod -R 777 /usr/share/vgabios/*
    virsh undefine --nvram Immutable10VM
    virsh define /tmp/Immutable10VM.xml`.split("\n").map((i) => i.trim()).join("\n"),
    true
  );
}
