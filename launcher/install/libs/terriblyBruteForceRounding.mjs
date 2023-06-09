export function terriblyBruteForceRoundingDownCPUOrMemory(number, count) {  
  let prevResult = Math.pow(2, count);

  for (let i = count; i > 0; i--) {
    const multiple = prevResult/2;
    prevResult = multiple;

    if (multiple < number) return multiple;
  }

  return number;
}