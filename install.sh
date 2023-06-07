#!/bin/bash

if [ "$DEBUG" == "true" ]; then
  set -x
  echo "Debugging is enabled."
fi

cat << EOF
 ___  _____ ______   _____ ______   ___  ___  _________  ________  ________  ___       _______     _____  ________     
|\\  \\|\\   _ \\  _   \\|\\   _ \\  _   \\|\\  \\|\\  \\|\\___   ___\\\\   __  \\|\\   __  \\|\\  \\     |\\  ___ \\   / __  \\|\\   __  \\    
\\ \\  \\ \\  \\\\\\__\\ \\  \\ \\  \\\\\\__\\ \\  \\ \\  \\\\\\  \\|___ \\  \\_\\ \\  \\|\\  \\ \\  \\|\\ /\\ \\  \\    \\ \\   __/| |\\/_|\\  \\ \\  \\|\\  \\   
 \\ \\  \\ \\  \\\\|__| \\  \\ \\  \\\\|__| \\  \\ \\  \\\\\\  \\   \\ \\  \\ \\ \\   __  \\ \\   __  \\ \\  \\    \\ \\  \\_|/_\\|/ \\ \\  \\ \\  \\\\\\  \\  
  \\ \\  \\ \\  \\    \\ \\  \\ \\  \\    \\ \\  \\ \\  \\\\\\  \\   \\ \\  \\ \\ \\  \\ \\  \\ \\  \\|\\  \\ \\  \\____\\ \\  \\_|\\ \\   \\ \\  \\ \\  \\\\\\  \\ 
   \\ \\__\\ \\__\\    \\ \\__\\ \\__\\    \\ \\__\\ \\_______\\   \\ \\__\\ \\ \\__\\ \\__\\ \\_______\\ \\_______\\ \\_______\\   \\ \\__\\ \\_______\\
    \\|__|\\|__|     \\|__|\\|__|     \\|__|\\|_______|    \\|__|  \\|__|\\|__|\\|_______|\\|_______|\\|_______|    \\|__|\\|_______|
                                                                                                                       
EOF

win_exit() {
  echo "Immutable10 cannot be setup. Exiting..."
  exit 1
}

echo "Immutable10 Install Script"
echo "0. Sanity checks..."

# Check if DMAR has loaded
# NOTE: Replace with DMAR if this test fails
sudo dmesg | grep -i "DMAR: IOMMU enabled"

if [ $? == 1 ]; then
  if [ -f "iommu_install_started" ]; then
    echo "IOMMU was enabled in Linux, but was not enabled in your BIOS."
    echo "If it does not show up in your BIOS, then your computer is NOT supported!"
    win_exit
  fi

  echo "IOMMU is (likely) not enabled in Linux. Would you like to attempt to enable it through this script?"
  printf "(Y/n) Should I attempt to enable IOMMU? "
  read should_attempt_iommu

  # Check if does_agree, converted to lowercase, does not start with y.
  if [[ "${should_attempt_iommu,,}" != y* ]]; then
    echo "Manually enable IOMMU, then retry this script."
    echo "See: https://access.redhat.com/documentation/en-us/red_hat_virtualization/4.1/html/installation_guide/appe-configuring_a_hypervisor_host_for_pci_passthrough"
    win_exit
  fi

  printf "Who is your CPU vendor? (amd/intel, CASE SENSITIVE!!) "
  read cpu_vendor

  if [ "$cpu_vendor" != "amd" ] && [ "$cpu_vendor" != "intel" ]; then
    echo "Invalid vendor, or your CPU is unsupported!"
    win_exit
  fi

  # Make a backup of the grub default config if something breaks terribly
  sudo cp /etc/default/grub /etc/default/grub.bak

  cat <<EOF >> tmp_add_iommu.py
# This code is a mirror of the embedded python script in "install.sh".
# I don't like the way I have to do this, but oh well.
import sys

cpu_type = sys.argv[1]

# Pure comedy.
f_text_handle = open("/etc/default/grub")
f_text = f_text_handle.read()

f_text_handle.close()

lines = f_text.split("\n")

with open("/etc/default/grub", "wt") as f:
  # There's probably a better way to do this, but I'm lazy.
  for line_num in range(0, len(lines)-1):
    line = lines[line_num]

    if line.startswith("GRUB_CMDLINE_LINUX_DEFAULT"):
      print("[py]: Found grub command line entry. Modifying...")

      grub_cmdline_split = line.split('GRUB_CMDLINE_LINUX_DEFAULT="')
      grub_cmdline_split.insert(1, f"{cpu_type}_iommu=on iommu=pt")
      
      # Apparently python also joins at the end or something, because I have to do
      # this sketchy thing.
      lines[line_num] = 'GRUB_CMDLINE_LINUX_DEFAULT="' + "".join(grub_cmdline_split)
  
  line_joined = "\n".join(lines)

  print("Writing changes...")
  f.write(line_joined)
EOF

  sudo python3 tmp_add_iommu.py $cpu_vendor

  if [ $? == 1 ]; then

    echo "Failed to add IOMMU support!"
    echo "You can try the script again, or manually enable IOMMU:"
    echo "See: https://access.redhat.com/documentation/en-us/red_hat_virtualization/4.1/html/installation_guide/appe-configuring_a_hypervisor_host_for_pci_passthrough"

    echo "Rolling back changes..."
    sudo cp /etc/default/grub.bak /etc/default/grub
    rm -rf tmp_add_iommu.py

    win_exit
  fi

  rm -rf tmp_add_iommu.py

  echo "Updating GRUB..."
  sudo update-grub

  echo "Notifying self of future changes..."
  touch iommu_install_started

  echo "Done. Rebooting in 3 seconds..."
  sleep 3
  sudo reboot

  # Just in case.
  exit 0
fi

# EULA acceptance
echo "For ease of use, we will automatically set up the created Windows install, which skips the EULA page."
echo "However, you would need to agree to the Windows EULA, which is avaliable at:"
echo "  - Windows 10: https://www.microsoft.com/en-us/Useterms/Retail/Windows/10/UseTerms_Retail_Windows_10_English.htm"
echo "  - Windows 11: https://www.microsoft.com/en-us/UseTerms/Retail/Windows/11/UseTerms_Retail_Windows_11_English.htm"
printf "\n(Y/n) Do you agree to the Microsoft EULA? "
read does_agree

# Check if does_agree, converted to lowercase, does not start with y.
if [[ "${does_agree,,}" != y* ]]; then
  echo "You did not agree to the Windows EULA! Exiting..."
  win_exit
fi

echo "1. Installing packages..."
echo " - Updating package lists..."
sudo apt update
echo " - Updating the OS..."
sudo apt upgrade
echo " - Installing libvirtd + QEMU..."
sudo apt -y install cpu-checker qemu-kvm qemu-utils libvirt-daemon-system libvirt-clients bridge-utils ovmf
echo "2. Checking virtualization compatibility..."

sudo kvm-ok

if [ $? == 1 ]; then 
  echo "Cannot find the Linux KVM device!"
  echo "You need to enable virtualization in your BIOS."
  win_exit
fi