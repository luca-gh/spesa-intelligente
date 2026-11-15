export interface SearchChoice {
  value: string
  label: string
  kind?: string
}
const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it')
    .trim()
const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true })
export function matchingChoices(choices: SearchChoice[], query: string) {
  const terms = normalized(query).split(/\s+/).filter(Boolean)
  return choices
    .filter((choice) =>
      terms.every((term) => normalized(`${choice.label} ${choice.kind ?? ''}`).includes(term)),
    )
    .sort(
      (a, b) =>
        collator.compare(a.label, b.label) ||
        collator.compare(a.kind ?? '', b.kind ?? '') ||
        a.value.localeCompare(b.value),
    )
}
