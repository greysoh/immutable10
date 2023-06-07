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