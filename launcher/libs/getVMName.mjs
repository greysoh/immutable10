import { options } from "../buildOpts.js";

export function getVMName() {
  return Deno.env.get("VM_NAME") ?? options.defaultVMName;
}