export async function getEligibleIOMMUGroups() {
  // Script taken from https://github.com/QaidVoid/Complete-Single-GPU-Passthrough
  await Deno.writeTextFile("/tmp/iommuGroups", `#!/bin/bash
shopt -s nullglob
for g in \`find /sys/kernel/iommu_groups/* -maxdepth 0 -type d | sort -V\`; do
    echo "IOMMU Group \${g##*/}:"
    for d in $g/devices/*; do
        echo -e "$(lspci -nns \${d##*/})"
    done;
done;`);
  
  console.log("Waiting for IOMMU groups to propagate...");

  const cmd = Deno.run({
    cmd: ["bash", "/tmp/iommuGroups"], 
    stdout: "piped",
    stderr: "piped"
  });

  const iommuGroupsRaw = await cmd.output();
  cmd.close();

  const iommuGroupsStr = new TextDecoder().decode(iommuGroupsRaw);
  const groups = [];

  for (const linesRaw of iommuGroupsStr.split("IOMMU Group ")) {
    const lineRaw = linesRaw.split("\n");
    const group = [];

    for (const line of lineRaw) {
      if (line.endsWith(":")) continue;
      if (line == "") continue;

      const pciId = line.split(" ")[0];
      const pciType = line.replace(pciId, "").split("[")[0].trim();
      const pciName = line.split(": ")[1];

      if (pciId == "00:00.0" && groups.length != 0) {
        console.warn("WARNING: Premature Array write detected! Fixing...");

        groups.splice(0, groups.length);
        group.splice(0, group.length);
      }

      const info = {
        pciId,
        pciType,
        pciName
      };

      group.push(info);
    }

    if (group.length != 0) groups.push(group);
  }

  return groups;
}