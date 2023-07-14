import { exists } from "https://deno.land/std@0.191.0/fs/mod.ts";

import { options } from "../buildOpts.js";
import { getVMName } from "../libs/getVMName.mjs";
import { runAndExecuteBash } from "../libs/runAndExecuteBashScript.mjs";

export async function stop() {
  if (!options.enableImmutability) return false;
  const vmSnapshotName = getVMName() == options.defaultVMName ? "OS" : `${getVMName()}_OS`;

  if (await exists("/tmp/enableWriteSaving")) {
    await runAndExecuteBash(`#!/bin/bash
virsh snapshot-delete --domain ${getVMName()} --snapshotname ${vmSnapshotName}
virsh snapshot-create-as --domain ${getVMName()} --name ${vmSnapshotName}`);
  } else {
    await runAndExecuteBash(`#!/bin/bash
virsh snapshot-revert --domain ${getVMName()} --snapshotname ${vmSnapshotName}`)
  }

  await runAndExecuteBash("#!/bin/bash\nsudo systemctl poweroff");
  return true;
}