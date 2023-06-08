// This function was written by AI.

export async function getRootPartitionSize() {
  // Check the OS platform
  if (Deno.build.os === "windows") {
    console.log("Warning: getRootPartitionSize() is not supported on Windows. Returning 128 gigabytes.");
    return 131072;
  }

  // Read the contents of /etc/fstab, then split it.
  const fstab = await Deno.readTextFile("/etc/fstab");
  const lines = fstab.split("\n");

  // Find the line that contains the root partition
  const rootLine = lines.find(line => line.includes(" / "));

  if (!rootLine) {
    throw new Error("Could not find root partition in /etc/fstab");
  }

  // Extract the device name from the line
  const device = rootLine.split(" ")[0];

  // Get the file info for the device, then serve it in megabytes
  const fileInfo = await Deno.stat(device);
  return fileInfo.size / (1024 * 1024);
}