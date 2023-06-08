export async function df() {
  // Check the OS platform
  if (Deno.build.os != "linux") throw new Error("DF is only available on Linux.");
  
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

  return itemObject;
}