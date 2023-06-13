export async function getVirtNetworkDevices(net = "default") {
  const cmd = Deno.run({
    cmd: ["virsh", "net-dhcp-leases", net], 
    stdout: "piped",
    stderr: "piped"
  });

  const networkRaw = await cmd.output();
  const networkStr = new TextDecoder().decode(networkRaw);

  cmd.close();

  const devices = [];

  for (const networkDevice of networkStr.split("\n")) {
    const trimmedDevice = networkDevice.trim();
    if (
      trimmedDevice.split("").filter((i) => i == "-").length > 5 ||
      trimmedDevice.includes("MAC address") ||
      trimmedDevice == "\n"
    )
      continue;

    const splitDetails = trimmedDevice.split(" ").filter((i) => i != "");
    
    // If, somehow, all the other checks pass, we do one final check.
    if (splitDetails.length != 7) continue;

    devices.push({
      expiry: {
        date: splitDetails[0],
        time: splitDetails[1]
      },
      macAddress: splitDetails[2],
      protocol: splitDetails[3],
      ipAddress: splitDetails[4],
      hostname: splitDetails[5],
      clientID: splitDetails[6],
    });
  }

  return devices;
}