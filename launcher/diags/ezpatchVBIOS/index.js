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
}
