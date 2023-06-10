import { runAndExecuteBash } from "../install/libs/runAndExecuteBashScript.mjs";

export async function start() {
  console.log("Starting VM...")
  await runAndExecuteBash(`#!/bin/bash
virsh start Immutable10VM
`, true);

  console.log("Checking network status in 5 seconds..."); // TODO
  await new Promise((i) => setTimeout(i, 5000));
}