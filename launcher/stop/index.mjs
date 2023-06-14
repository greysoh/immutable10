import { exists } from "https://deno.land/std@0.191.0/fs/mod.ts";

import { runAndExecuteBash } from "../libs/runAndExecuteBashScript.mjs";

export async function stop() {
  if (await exists("/tmp/enableWriteSaving")) {
    await runAndExecuteBash(`#!/bin/bash
virsh snapshot-delete --domain Immutable10VM --snapshotname OS
virsh snapshot-create-as --domain Immutable10VM --name OS`);
  } else {
    await runAndExecuteBash(`#!/bin/bash
virsh snapshot-revert --domain Immutable10VM --snapshotname OS`)
  }

  await runAndExecuteBash("#!/bin/bash\nsudo systemctl poweroff");
}