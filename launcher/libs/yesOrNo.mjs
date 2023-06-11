export function yesOrNo(promptStr) {
  const userInput = prompt(promptStr);
  if (userInput == "" || typeof userInput == "undefined") return true;

  return userInput.trim().toLowerCase().startsWith("y");
}