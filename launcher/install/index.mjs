import { parse, stringify } from "https://deno.land/x/xml@2.1.1/mod.ts";

import { yesOrNo } from "../libs/yesOrNo.mjs";
import { runAndExecuteBash } from "../libs/runAndExecuteBashScript.mjs";
import { getRootPartitionSize } from "./libs/getRootPartitionSize.mjs";
import { getEligibleIOMMUGroups } from "../libs/getEligibleIOMMUGroups.mjs";
import { terriblyBruteForceRoundingDownCPUOrMemory } from "./libs/terriblyBruteForceRounding.mjs";

export async function installer() {
  console.log("\n############ CPU CONFIGURATION ############");

  const shouldRoundDownCPU = yesOrNo(
    "Would you like to round down your virtual CPU cores, to make it look more realistic?"
  );
  const cpusCalculatedRaw = navigator.hardwareConcurrency - 2;

  const cpusCalculated = shouldRoundDownCPU
    ? terriblyBruteForceRoundingDownCPUOrMemory(cpusCalculatedRaw, 10)
    : cpusCalculatedRaw;
  console.log("Current CPU cores calculated: " + cpusCalculated);

  const shouldSplitUpCoresAndThreads = yesOrNo(
    "Would you like to split your virtual CPU cores into threads? (for example, 8 physical cpu cores w/ 2 threads -> 4 core, 2 threads)"
  );
  let threadCount = 1;

  if (shouldSplitUpCoresAndThreads) {
    threadCount = parseInt(prompt("Thread count:"));

    if (threadCount != threadCount) {
      console.error(
        "Error: Thread count is not a number! Defaulting to 1 thread..."
      );
      threadCount = 1;
    }

    if (threadCount % 2) {
      if (
        yesOrNo(
          "Warning: The thread count is not a traditional multiple of 2! Would you like to round down?"
        )
      ) {
        threadCount = terriblyBruteForceRoundingDownCPUOrMemory(
          threadCount,
          10
        );
      }
    }
  }

  const cpuInfo = {
    cores: Math.floor(cpusCalculated / threadCount),
    threads: threadCount,
  };

  console.assert(cpuInfo.cores * cpuInfo.threads == cpusCalculated);

  console.log("\nFinal CPU information:");
  console.log(`  - Cores: ${cpuInfo.cores}`);
  console.log(`  - Threads: ${cpuInfo.threads}`);
  console.log(
    `  - Virtual cores (hyperthreading): ${cpuInfo.cores * cpuInfo.threads}`
  );

  console.log("\n############ MEMORY CONFIGURATION ############");

  const totalSystemMemory = Math.floor(
    Deno.systemMemoryInfo().total / 1024 / (Deno.build.os == "linux" ? 1024 : 1)
  );

  const shouldRoundDownMem = yesOrNo(
    "Would you like to round down your virtual memory, to make it look more realistic?"
  );
  const totalMemory = shouldRoundDownMem
    ? terriblyBruteForceRoundingDownCPUOrMemory(totalSystemMemory - 2048, 20)
    : totalSystemMemory - 2048;

  console.log(
    "Final memory size (in gigabytes, rounded): " +
      Math.floor(totalMemory / 1024)
  );
  console.log("\n############ STORAGE CONFIGURATION ############");

  const rootPartitionSize = await getRootPartitionSize();
  const shouldRoundDownStorage = yesOrNo(
    "Would you like to round down your storage, to make it look more realistic?"
  );

  const newPartitionSize = shouldRoundDownStorage
    ? terriblyBruteForceRoundingDownCPUOrMemory(rootPartitionSize / 2, 25)
    : rootPartitionSize / 2;
  console.log(
    "Final storage size (in gigabytes, rounded): " +
      Math.floor(newPartitionSize)
  );

  console.log("\n############ PCIe CONFIGURATION ############");
  // Windows can kinda be used before this, as a way to test memory, storage, and CPU cores,
  // but, after this, we run Linux shell commands, so it can't work anymore.

  if (Deno.build.os == "windows")
    throw new Error("Windows cannot be used beyond this point.");

  const iommuGroups = await getEligibleIOMMUGroups();
  console.log("Searching for eligible PCI devices...");

  // PCI ids of devices to passthrough in lspci format.
  // We need to convert this later, however, into the VFIO format.
  const passthroughDevices = [];

  // Guess the names of the drivers, to unload/reload.
  const gpuLikelyDriverNames = [];
  const hdaLikelyDriverNames = [];
  const miscDriverNames = [];

  for (const iommuGroup of iommuGroups) {
    const currentIOMMUGroup = iommuGroups.indexOf(iommuGroup);

    // NOTE: Any *SRAM* device crashes your PC if you try to pass it through.
    // See: https://www.reddit.com/r/VFIO/comments/rgpest/quick_question_about_intel_sram_pch/
    // HOWEVER, probably due to the SRAM being a form of a bridge device,
    // you can omit the device safely (tested.)

    // If the IOMMU group has more than 1 device, to be safe, we warn the user *no matter what*.
    // The user should be responsible for checking if passing through the current IOMMU group
    // is compatible or not.

    if (iommuGroup.length > 1) {
        console.log(
          "WARNING: More than 1 device found in the current IOMMU group!\n" +
          "If there is a device in this IOMMU group that you want, you would need to pass through all of them.\n" +
          "Be sure to check online if this operation is safe or not.\n" +
          "Here is the current list of devices:"
        );

        for (const device of iommuGroup) {
          console.log(
            " - %s %s: %s",
            device.pciId,
            device.pciType,
            device.pciName
          );
        }

        console.log("Current IOMMU group: %s", currentIOMMUGroup);

        if (
          yesOrNo(
            "Is there any in this pool that you want, and can pass through all of them safely?"
          )
        ) {
          console.log("Adding all devices!");

          passthroughDevices.push(
            ...iommuGroup
              .map((i) =>
                i.pciType != "PCI bridge" && i.pciType != "Host bridge" && !i.pciName.includes("SRAM")
                  ? i.pciId
                  : undefined
              )
              .filter(Boolean)
          );
        } else {
          console.log("Disabling passthrough of ANY device!");
          continue;
        }
    }

    for (const device of iommuGroup) {
      switch (device.pciType) {
        case "VGA compatible controller": {
          console.log(" - Found VGA device!");
          if (passthroughDevices.indexOf(device.pciId) == -1)
            passthroughDevices.push(device.pciId);

          // Attempt to detect the GPU drivers. This should likely be replaced with a more intelligent
          // check, someday. The only thing stopping that, is the fact that I'm lazy.
          if (device.pciName.startsWith("Intel")) {
            gpuLikelyDriverNames.push("i915");
          } else if (device.pciName.startsWith("NVIDIA")) {
            gpuLikelyDriverNames.push(
              "nvidia_drm",
              "nvidia_modeset",
              "drm_kms_helper",
              "nvidia_uvm",
              "nvidia"
            );
          } else if (device.pciName.startsWith("AMD")) {
            gpuLikelyDriverNames.push("amdgpu");
          }

          break;
        }

        case "Audio device": {
          console.log(" - Found audio device!");
          if (passthroughDevices.indexOf(device.pciId) == -1)
            passthroughDevices.push(device.pciId);

          if (
            device.pciName.startsWith("NVIDIA") ||
            device.pciName.startsWith("AMD")
          ) {
            console.log(" - Device is NVIDIA/AMD. Skipping.");
            continue;
          } else if (device.pciName.startsWith("Intel")) {
            hdaLikelyDriverNames.push("snd_hda_intel", "snd_sof_pci_intel_cnl");
          }

          break;
        }

        case "USB controller": {
          console.log(" - Found USB device!");
          if (passthroughDevices.indexOf(device.pciId) == -1)
            passthroughDevices.push(device.pciId);

          break;
        }
      }
    }
  }

  // Great workaround.
  let hasShownIOMMUList = false;

  // Wait until the user says no.
  while (yesOrNo("Would you like to add more PCIe devices?")) {
    if (!hasShownIOMMUList) {
      for (const iommuGroup of iommuGroups) {
        console.log("IOMMU Group %s:", iommuGroups.indexOf(iommuGroup));

        for (const device of iommuGroup) {
          console.log(
            " - %s %s: %s",
            device.pciId,
            device.pciType,
            device.pciName
          );
        }
      }

      hasShownIOMMUList = true;
    }

    const iommuGroupToPassThrough = prompt(
      "What IOMMU group would you like to pass through?"
    );
    const iommuGroupNum = parseInt(iommuGroupToPassThrough.trim());

    // Check if the iommuGroupNumber is a number, and then check if it's in range.
    if (iommuGroupNum != iommuGroupNum) {
      console.error("Not a number!");
      continue;
    } else if (iommuGroupNum > iommuGroups.length - 1 || iommuGroupNum < 0) {
      console.error("Number too large!");
      continue;
    }

    passthroughDevices.push(
      ...iommuGroups[iommuGroupNum]
        .map((i) =>
          i.pciType != "PCI bridge" && !i.pciName.includes("SRAM")
            ? i.pciId
            : undefined
        )
        .filter(Boolean)
    );

    // If the drivers support hotplug (ex. like a USB card), Linux takes care of everything.
    if (
      !yesOrNo(
        "Do the drivers for each device support hotplug (ex. USB cards)?"
      )
    ) {
      const drivers = prompt(
        "What are the drivers needed for each card (space seperated value)?"
      );
      const driverList = drivers.split(" ");

      miscDriverNames.push(...driverList);
    }
  }

  console.log("\nDevices to pass through: %s", passthroughDevices.join(" "));
  console.log(
    "GPU drivers to disable/enable: %s",
    gpuLikelyDriverNames.join(" ")
  );
  console.log(
    "HDA drivers to disable/enable: %s",
    hdaLikelyDriverNames.join(" ")
  );
  console.log("Misc drivers to disable/enable: %s", miscDriverNames.join(" "));

  prompt("\nPress any key to start the virtual machine configuration process.");
  console.log("Creating virtual machine...");

  // Paths to all the different disks and ISOs.
  const diskDir = `${Deno.env.get("HOME")}/Windows.qcow2`;
  const windowsISO = `${Deno.env.get("HOME")}/Windows.iso`;
  const virtioISO = `${Deno.env.get("HOME")}/virtio-win.iso`;

  console.log(" - Creating hard disk...");
  const diskCreationCmd = Deno.run({
    cmd: ["qemu-img", "create", "-f", "qcow2", diskDir, `${newPartitionSize}G`],
    stdout: "piped",
    stderr: "piped",
  });

  const diskOutput = await diskCreationCmd.output();
  diskCreationCmd.close();

  const diskOutputString = new TextDecoder().decode(diskOutput);

  for (const line of diskOutputString.split("\n")) {
    if (line == "") continue;
    console.log(`   - ${line}`);
  }

  console.log(" - Creating virtual machine XML...");

  // Options to create the VM with.
  const opts = [
    "--name=Immutable10VM",
    `--ram=${totalMemory}`,
    `--vcpus='sockets=1,cores=${cpuInfo.cores},threads=${cpuInfo.threads}'`,
    `--cpuset='0-${cpuInfo.cores * cpuInfo.threads - 1}'`,
    `--disk='path=${diskDir},bus=sata,startup_policy=optional,boot_order=1,size=${newPartitionSize}'`,
    `--cdrom='${windowsISO}'`,
    `--disk='device=cdrom,path=${virtioISO},bus=sata,boot_order=3'`,
    `--graphics=none`,
    `--osinfo=win10`,
    `--print-xml`,
    `--boot=uefi`,
    `--check='path_in_use=off'`,
  ];

  // We recreate the names of the PCI devices because the IDs we store are in the lspci format.
  // (mentioned above)
  const regeneratedPCIDevices = passthroughDevices.map(
    (i) => `pci_0000_${i.replace(":", "_").replace(".", "_")}`
  );

  for (const device of regeneratedPCIDevices) {
    opts.push(`--host-device='${device}'`);
  }

  const vmOutput = await runAndExecuteBash(`#!/bin/bash
virt-install ${opts.join(" ")}`);

  console.log(" - Opening VM for writing...");
  const vmOutputXML = new TextDecoder().decode(vmOutput);

  // I don't know if I'm doing it wrong, but for some reason, virt-install w/ XML exporting
  // returns 2 xml documents(?). So I have to do this madness.
  const vmOutputXMLFix = vmOutputXML.split("</domain>")[0] + "</domain>"; // This is fine.

  const vmXML = parse(vmOutputXMLFix);

  console.log(" - Enabling QoL features...");
  vmXML.domain.features.kvm = {
    hidden: {
      "@state": "on",
      "#text": null,
    },
  };

  vmXML.domain.os.bootmenu = {
    "@enable": "yes",
    "#text": null,
  };

  console.log(" - Importing created VM XML...");
  await Deno.writeTextFile("/tmp/vm.xml", stringify(vmXML));

  console.log(" - Setting up hooks...");

  // Scripts burrowed from https://github.com/QaidVoid/Complete-Single-GPU-Passthrough
  // Actual path: /etc/libvirt/hooks/qemu
  await Deno.writeTextFile(
    "/tmp/hooksdispatch",
    `#!/bin/bash

GUEST_NAME="$1"
HOOK_NAME="$2"
STATE_NAME="$3"
MISC="\${@:4}"
  
BASEDIR="$(dirname $0)"
  
HOOKPATH="$BASEDIR/qemu.d/$GUEST_NAME/$HOOK_NAME/$STATE_NAME"
set -e # If a script exits with an error, we should as well.
  
if [ -f "$HOOKPATH" ]; then
eval \""$HOOKPATH"\" "$@"
elif [ -d "$HOOKPATH" ]; then
while read file; do 
eval \""$file"\" "$@"
done <<< "$(find -L "$HOOKPATH" -maxdepth 1 -type f -executable -print;)"
fi`
  );

  let startCommand = `#!/bin/bash
set -x
        
# Unbind VTconsoles: might not be needed
echo 0 > /sys/class/vtconsole/vtcon0/bind
echo 0 > /sys/class/vtconsole/vtcon1/bind
    
# Unbind EFI Framebuffer
echo efi-framebuffer.0 > /sys/bus/platform/drivers/efi-framebuffer/unbind
    
# Unload GPU kernel modules
${
  gpuLikelyDriverNames.length != 0
    ? `modprobe -r ${gpuLikelyDriverNames.join(" ")}`
    : ""
}
    
# Unload audio kernel modules
${
  hdaLikelyDriverNames.length != 0
    ? `modprobe -r ${hdaLikelyDriverNames.join(" ")}`
    : ""
}
  
# Unload misc kernel modules
${miscDriverNames.length != 0 ? `modprobe -r ${miscDriverNames.join(" ")}` : ""}
    
# Detach a whole bunch of shit from the host
`;

  for (const device of regeneratedPCIDevices) {
    startCommand += `virsh nodedev-detach ${device}\n`;
  }

  startCommand += `# Load VFIO\nmodprobe vfio-pci`;

  let endCommand = `#!/bin/bash\nset -x\n\n# Reattach a whole bunch of shit from the host\n`;
  for (const device of regeneratedPCIDevices) {
    endCommand += `virsh nodedev-reattach ${device}\n`;
  }

  endCommand += `
# Unload VFIO
modprobe -r vfio-pci

# Rebind framebuffer to host
echo "efi-framebuffer.0" > /sys/bus/platform/drivers/efi-framebuffer/bind

# Load GPU kernel modules
${
  gpuLikelyDriverNames.length != 0
    ? `modprobe ${gpuLikelyDriverNames.join(" ")}`
    : ""
}
    
# Load audio kernel modules
${
  hdaLikelyDriverNames.length != 0
    ? `modprobe ${hdaLikelyDriverNames.join(" ")}`
    : ""
}
  
# Load misc kernel modules
${miscDriverNames.length != 0 ? `modprobe ${miscDriverNames.join(" ")}` : ""}

# Bind VTconsoles: might not be needed
echo 1 > /sys/class/vtconsole/vtcon0/bind
echo 1 > /sys/class/vtconsole/vtcon1/bind`;

  // Actual path: /etc/libvirt/hooks/qemu.d/Immutable10VM/prepare/begin/start.sh
  await Deno.writeTextFile("/tmp/start.sh", startCommand);

  // Actual path: /etc/libvirt/hooks/qemu.d/Immutable10VM/release/end/stop.sh
  await Deno.writeTextFile("/tmp/stop.sh", endCommand);

  // Very hacky but I'm too lazy to add proper root support.
  console.log(" - Saving settings...");

  // Incase you wanted to see why we had to boot Windows out, this is why.
  await runAndExecuteBash(
    `
#!/bin/bash
set -x
echo "Hello to your empending doom. Bash inside JavaScript - GH"

chmod +x /tmp/hooksdispatch
chmod +x /tmp/start.sh
chmod +x /tmp/stop.sh

sudo mkdir -p /etc/libvirt/hooks
sudo mkdir -p /etc/libvirt/hooks/qemu.d/Immutable10VM/prepare/begin
sudo mkdir -p /etc/libvirt/hooks/qemu.d/Immutable10VM/release/end

sudo cp /tmp/hooksdispatch /etc/libvirt/hooks/qemu
sudo cp /tmp/start.sh /etc/libvirt/hooks/qemu.d/Immutable10VM/prepare/begin/start.sh
sudo cp /tmp/stop.sh /etc/libvirt/hooks/qemu.d/Immutable10VM/release/end/stop.sh

virsh define /tmp/vm.xml
`,
    true
  );
}
