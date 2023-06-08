export function addToBridge(iommuGroup, passthroughDevices) {
  const bridgeDev = iommuGroup.find((i) => i.pciType == "PCI bridge");
  if (bridgeDev) {
    if (passthroughDevices.indexOf(bridgeDev.pciId) == -1) passthroughDevices.push(bridgeDev.pciId);
  }

  return;
}