export async function getUSBDevices() {
  const cmd = Deno.run({
    cmd: ["lsusb"], 
    stdout: "piped",
    stderr: "piped"
  });

  const usbDeviceRaw = await cmd.output();
  const usbDeviceStr = new TextDecoder().decode(usbDeviceRaw);

  cmd.close();

  const usbData = [];

  for (const device of usbDeviceStr.split("\n")) {
    if (device.trim() == "") continue;
    
    const busName = device.split(": ");
    const busSplit = busName[0].split(" Device ");

    const usbLocation = {
      bus: parseInt(busSplit[0].replace("Bus ", "")),
      device: parseInt(busSplit[1])
    };

    const usbIDParts = busName[1].replace("ID ", "").split(":");
  
    const usbID = {
      vendorID: usbIDParts[0],
      deviceID: usbIDParts[1].split(" ")[0]
    };

    const name = busName[1].split(usbID.deviceID + " ")[1];

    usbData.push({
      usbLocation,
      usbID,
      name
    });
  }

  return usbData;
}