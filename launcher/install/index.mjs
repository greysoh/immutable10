import { getRootPartitionSize } from "./libs/getRootPartitionSize.mjs";

function yesOrNo(promptStr) {
  const userInput = prompt(promptStr);

  return userInput.toLowerCase().startsWith("y");
}

function terriblyBruteForceRoundingDownCPUOrMemory(number, count) {  
  let prevResult = Math.pow(2, count);

  for (let i = count; i > 0; i--) {
    const multiple = prevResult/2;
    prevResult = multiple;

    if (multiple < number) return multiple;
  }

  return number;
}

export async function installer() {
  console.log("\n############ CPU CONFIGURATION ############");

  const shouldRoundDownCPU = yesOrNo("Would you like to round down your virtual CPU cores, to make it look more realistic?");
  const cpusCalculatedRaw = navigator.hardwareConcurrency-2;

  const cpusCalculated = shouldRoundDownCPU ? terriblyBruteForceRoundingDownCPUOrMemory(cpusCalculatedRaw, 10) : cpusCalculatedRaw;
  console.log("Current CPU cores calculated: " + cpusCalculated);
  
  const shouldSplitUpCoresAndThreads = yesOrNo("Would you like to split your virtual CPU cores into threads? (for example, 8 physical cpu cores w/ 2 threads -> 4 core, 2 threads)");
  let threadCount = 1;

  if (shouldSplitUpCoresAndThreads) {
    threadCount = parseInt(prompt("Thread count:"));

    if (threadCount != threadCount) {
      console.error("Error: Thread count is not a number! Defaulting to 1 thread...");
      threadCount = 1;
    }

    if (threadCount % 2) {
      if (yesOrNo("Warning: The thread count is not a traditional multiple of 2! Would you like to round down?")) {
        threadCount = terriblyBruteForceRoundingDownCPUOrMemory(threadCount, 10);
      }
    }
  }
  
  const cpuInfo = {
    cores: Math.floor(cpusCalculated/threadCount),
    threads: threadCount
  }

  console.assert(cpuInfo.cores*cpuInfo.threads == cpusCalculated);

  console.log("\nFinal CPU information:");
  console.log(`  - Cores: ${cpuInfo.cores}`);
  console.log(`  - Threads: ${cpuInfo.threads}`);
  console.log(`  - Virtual cores (hyperthreading): ${cpuInfo.cores*cpuInfo.threads}`);

  console.log("\n############ MEMORY CONFIGURATION ############");

  const totalSystemMemory = Math.floor(Deno.systemMemoryInfo().total/1024/(Deno.build.os == "linux" ? 1024 : 1));
  
  const shouldRoundDownMem = yesOrNo("Would you like to round down your virtual memory, to make it look more realistic?");
  const totalMemory = shouldRoundDownMem ? terriblyBruteForceRoundingDownCPUOrMemory((totalSystemMemory-2048), 20) : (totalSystemMemory-2048);

  console.log("Final memory size (in gigabytes, rounded): " + Math.floor(totalMemory/1024));
  console.log("\n############ STORAGE CONFIGURATION ############");

  const rootPartitionSize = await getRootPartitionSize();
  const shouldRoundDownStorage = yesOrNo("Would you like to round down your storage, to make it look more realistic?");

  const newPartitionSize = shouldRoundDownStorage ? terriblyBruteForceRoundingDownCPUOrMemory(rootPartitionSize-32, 25) : rootPartitionSize-32;
  console.log("Final storage size (in gigabytes, rounded): " + Math.floor(newPartitionSize));

  console.log("\n############ PCIe CONFIGURATION ############");
  console.log("TODO");
}