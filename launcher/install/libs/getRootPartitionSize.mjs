export async function getRootPartitionSize() {
  // Check the OS platform
  if (Deno.build.os === "windows") {
    console.log("Warning: getRootPartitionSize() is not supported on Windows. Returning 128 gigabytes.");
    return 131072;
  }
  
  // Start up df, and prepare for all the parsing fun!
  const cmd = Deno.run({
    cmd: ["df"], 
    stdout: "piped",
    stderr: "piped"
  });

  const output = await cmd.output();
  cmd.close();

  const outputIntoString = new TextDecoder().decode(output);

  const outputSplitByNewLine = outputIntoString.split(" ").filter((i) => i != "").join(" ").split("\n");
  outputSplitByNewLine.shift();

  const itemObject = [];

  for (const item of outputSplitByNewLine) {
    const itemIndividualPieces = item.split(" ");
    if (itemIndividualPieces[0] == "") continue;

    itemObject[itemObject.length] = {
      path: itemIndividualPieces[0],
      blocksAllocated1K: itemIndividualPieces[1],
      used: parseInt(itemIndividualPieces[2]),
      available: parseInt(itemIndividualPieces[3]),
      mountedAt: itemIndividualPieces[5],
    }
  }

  const item = itemObject.find((i) => i.mountedAt == "/");
  console.log((item.used+item.available)/(1024*1024));

  return (item.used+item.available)/(1024*1024);
}