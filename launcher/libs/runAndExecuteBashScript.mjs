export async function runAndExecuteBash(script, disablePiping) {
  // For people that use doas
  const scr = Deno.env.get("USE_DOAS") ? script.replaceAll("sudo", "doas") : script;
  await Deno.writeTextFile("/tmp/script", scr);

  const opts = {
    cmd: ["bash", "/tmp/script"]
  }

  if (!disablePiping) {
    opts.stdout = "piped";
    opts.stderr = "piped";
  }
  
  const bashCmd = Deno.run(opts);

  await bashCmd.status();
  if (disablePiping) return;
  
  const bashOutput = await bashCmd.output();
  bashCmd.close();

  await Deno.remove("/tmp/script");

  return bashOutput;
}