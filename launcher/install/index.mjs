import { addToBridge } from "./libs/bridgeAdd.mjs";
import { getEligibleIOMMUGroups } from "./libs/getEligibleIOMMUGroups.mjs";
import { getRootPartitionSize } from "./libs/getRootPartitionSize.mjs";

function yesOrNo(promptStr) {
  const userInput = prompt(promptStr);
  if (userInput == "" || typeof userInput == "undefined") return true;

  return userInput.trim().toLowerCase().startsWith("y");
}

function terriblyBruteForceRoundingDownCPUOrMemory(number, count) {  
  let prevResult = Math.pow(2, count);

  for (let i = count; i > 0; i--) {
    const multiple = prevResult/2;
    prevResult = multiple;

    if (multiple < number) return multiple;
  }

  return number;
}

export async function installer() {
  console.log("\n############ CPU CONFIGURATION ############");

  const shouldRoundDownCPU = yesOrNo("Would you like to round down your virtual CPU cores, to make it look more realistic?");
  const cpusCalculatedRaw = navigator.hardwareConcurrency-2;

  const cpusCalculated = shouldRoundDownCPU ? terriblyBruteForceRoundingDownCPUOrMemory(cpusCalculatedRaw, 10) : cpusCalculatedRaw;
  console.log("Current CPU cores calculated: " + cpusCalculated);
  
  const shouldSplitUpCoresAndThreads = yesOrNo("Would you like to split your virtual CPU cores into threads? (for example, 8 physical cpu cores w/ 2 threads -> 4 core, 2 threads)");
  let threadCount = 1;

  if (shouldSplitUpCoresAndThreads) {
    threadCount = parseInt(prompt("Thread count:"));

    if (threadCount != threadCount) {
      console.error("Error: Thread count is not a number! Defaulting to 1 thread...");
      threadCount = 1;
    }

    if (threadCount % 2) {
      if (yesOrNo("Warning: The thread count is not a traditional multiple of 2! Would you like to round down?")) {
        threadCount = terriblyBruteForceRoundingDownCPUOrMemory(threadCount, 10);
      }
    }
  }
  
  const cpuInfo = {
    cores: Math.floor(cpusCalculated/threadCount),
    threads: threadCount
  }

  console.assert(cpuInfo.cores*cpuInfo.threads == cpusCalculated);

  console.log("\nFinal CPU information:");
  console.log(`  - Cores: ${cpuInfo.cores}`);
  console.log(`  - Threads: ${cpuInfo.threads}`);
  console.log(`  - Virtual cores (hyperthreading): ${cpuInfo.cores*cpuInfo.threads}`);

  console.log("\n############ MEMORY CONFIGURATION ############");

  const totalSystemMemory = Math.floor(Deno.systemMemoryInfo().total/1024/(Deno.build.os == "linux" ? 1024 : 1));
  
  const shouldRoundDownMem = yesOrNo("Would you like to round down your virtual memory, to make it look more realistic?");
  const totalMemory = shouldRoundDownMem ? terriblyBruteForceRoundingDownCPUOrMemory((totalSystemMemory-2048), 20) : (totalSystemMemory-2048);

  console.log("Final memory size (in gigabytes, rounded): " + Math.floor(totalMemory/1024));
  console.log("\n############ STORAGE CONFIGURATION ############");

  const rootPartitionSize = await getRootPartitionSize();
  const shouldRoundDownStorage = yesOrNo("Would you like to round down your storage, to make it look more realistic?");

  const newPartitionSize = shouldRoundDownStorage ? terriblyBruteForceRoundingDownCPUOrMemory(rootPartitionSize/2, 25) : rootPartitionSize/2;
  console.log("Final storage size (in gigabytes, rounded): " + Math.floor(newPartitionSize));

  console.log("\n############ PCIe CONFIGURATION ############");
  if (Deno.build.os == "windows") throw new Error("Windows cannot be used beyond this point.");

  const iommuGroups = await getEligibleIOMMUGroups();
  console.log("Searching for eligible PCI devices...");
  
  const passthroughDevices = [];
  const gpuLikelyDriverNames = [];
  const hdaLikelyDriverNames = [];
  const miscDriverNames = [];

  for (const iommuGroup of iommuGroups) {
    const currentIOMMUGroup = iommuGroups.indexOf(iommuGroup);

    if (iommuGroup.some((i) => i.pciName.includes("SRAM"))) {
      console.error("ERROR: Cannot passthrough current IOMMU group!");
      console.error("Reason: SRAM/potential PCH. This will crash your computer if you pass this through.");

      continue;
    } else if (iommuGroup.length > 1) {
      if (iommuGroup.length != 2 && !iommuGroup.some((i) => i.pciType == "PCI bridge")) {
        console.log("WARNING: More than 1 device vendor found in the current IOMMU group!");
        console.log("If there is a device in this IOMMU group that you want, you would need to pass through all of them.");
        console.log("Be sure to check online if this operation is safe or not.");
        console.log("Here is the current list of devices:");

        for (const device of iommuGroup) {
          console.log(" - %s %s: %s", device.pciId, device.pciType, device.pciName);
        }

        console.log("Current IOMMU group: %s", currentIOMMUGroup);
  
        if (yesOrNo("Is there any in this pool that you want, and can pass through all of them safely?")) {
          console.log("Adding all devices!");

          passthroughDevices.push(...iommuGroup.map((i) => i.pciId));
        } else {
          console.log("Disabling passthrough of ANY device!");
          continue;
        }
      }
    }

    for (const device of iommuGroup) {
      switch (device.pciType) {
        case "VGA compatible controller": {
          console.log(" - Found VGA device!");
          if (passthroughDevices.indexOf(device.pciId) == -1) passthroughDevices.push(device.pciId);
          addToBridge(iommuGroup, passthroughDevices);

          if (device.pciName.startsWith("Intel")) {
            gpuLikelyDriverNames.push("i915");
          } else if (device.pciName.startsWith("NVIDIA")) {
            gpuLikelyDriverNames.push("nvidia_drm", "nvidia_modeset", "drm_kms_helper", "nvidia_uvm", "nvidia");
          } else if (device.pciName.startsWith("AMD")) {
            gpuLikelyDriverNames.push("amdgpu");
          }

          break;
        }

        case "Audio device": {
          console.log(" - Found audio device!");
          if (passthroughDevices.indexOf(device.pciId) == -1) passthroughDevices.push(device.pciId);
          addToBridge(iommuGroup, passthroughDevices);
          
          if (device.pciName.startsWith("NVIDIA") || device.pciName.startsWith("AMD")) {
            console.log(" - Device is NVIDIA/AMD. Skipping.");
            continue;
          } else if (device.pciName.startsWith("Intel")) {
            hdaLikelyDriverNames.push("snd_hda_intel", "snd_sof_pci_intel_cnl");
          }

          break;
        }

        case "USB controller": {
          console.log(" - Found USB device!");
          if (passthroughDevices.indexOf(device.pciId) == -1) passthroughDevices.push(device.pciId);
          addToBridge(iommuGroup, passthroughDevices);

          break;
        }
      }
    }
  }

  let hasShownIOMMUList = false;
  while (yesOrNo("Would you like to add more PCIe devices?")) {
    if (!hasShownIOMMUList) {
      for (const iommuGroup of iommuGroups) {
        console.log("IOMMU Group %s:", iommuGroups.indexOf(iommuGroup));
  
        for (const device of iommuGroup) {
          console.log(" - %s %s: %s", device.pciId, device.pciType, device.pciName);
        }
      }

      hasShownIOMMUList = true;
    }

    const iommuGroupToPassThrough = prompt("What IOMMU group would you like to pass through?");
    const iommuGroupNum = parseInt(iommuGroupToPassThrough.trim());

    if (iommuGroupNum != iommuGroupNum) {
      console.error("Not a number!");
      continue;
    } else if (iommuGroupNum > iommuGroups.length-1|| iommuGroupNum < 0) {
      console.error("Number too large!");
      continue;
    }

    passthroughDevices.push(...iommuGroups[iommuGroupNum].map((i) => i.pciId));

    if (!yesOrNo("Do the drivers for each device support hotplug (ex. graphics cards need this off)?")) {
      const drivers = prompt("What are the drivers needed for each card (space seperated value)?");
      const driverList = drivers.split(" ");

      miscDriverNames.push(...driverList);
    }
  }

  console.log("\nDevices to pass through: %s", passthroughDevices.join(" "));
  console.log("GPU drivers to disable/enable: %s", gpuLikelyDriverNames.join(" "));
  console.log("HDA drivers to disable/enable: %s", hdaLikelyDriverNames.join(" "));
  console.log("Misc drivers to disable/enable: %s", miscDriverNames.join(" "));
}