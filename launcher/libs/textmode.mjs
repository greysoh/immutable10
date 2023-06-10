export function choiceMenu(title, ...choices) {
  console.log(title + "\n");

  for (const choice of choices) {
    if (typeof choice != "string") throw new Error("Invalid choice specified in ChoiceMenu");

    console.log(`${choices.indexOf(choice)+1}: ${choice}`);
  }

  console.log("");
  const optionParsed = parseInt(prompt(">"));

  if (optionParsed != optionParsed) throw new Error("Invalid option");
  if (optionParsed <= 0 || optionParsed > choices.length) throw new Error("Invalid option");

  return optionParsed;
}