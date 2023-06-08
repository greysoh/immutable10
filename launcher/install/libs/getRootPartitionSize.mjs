import { df } from "./df.mjs";

export async function getRootPartitionSize() {
  if (Deno.build.os === "windows") {
    console.log("Warning: getRootPartitionSize() is not supported on Windows. Returning 128 gigabytes.");
    return 128;
  }

  const deviceStorageSpace = await df();
  const rootStorageSize = deviceStorageSpace.find((i) => i.mountedAt == "/");

  return (rootStorageSize.used+rootStorageSize.available)/(1024*1024);
}