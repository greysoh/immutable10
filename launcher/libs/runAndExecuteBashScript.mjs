export async function runAndExecuteBash(scr, disablePiping) {
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