import { expect, it } from 'vitest'
import { matchingChoices } from '../src/domain/choices'

it('cerca anche nel barcode e ordina per nome senza usare i dettagli della confezione', () => {
  const choices = [
    { value: 'long', label: 'Latte intero · Abit · 1 L', sortLabel: 'Latte intero' },
    { value: 'short', label: 'Latte · Zeta · 1 L', sortLabel: 'Latte', searchText: '8000500037560' },
  ]
  expect(matchingChoices(choices, '').map((c) => c.value)).toEqual(['short', 'long'])
  expect(matchingChoices(choices, '8000500')).toEqual([choices[1]])
  expect(matchingChoices(choices, 'latte abit')).toEqual([choices[0]])
})

it('ordina sempre per nome italiano senza modificare la lista originale', () => {
  const choices = [
    { value: 'z', label: 'Zucchine' },
    { value: 'c', label: 'Caffè' },
    { value: 'a', label: 'albicocche' },
  ]
  expect(matchingChoices(choices, '').map((c) => c.value)).toEqual(['a', 'c', 'z'])
  expect(choices.map((c) => c.value)).toEqual(['z', 'c', 'a'])
})
it('filtra parole parziali, ignorando accenti e maiuscole, e conserva gli identificativi', () => {
  const choices = [
    { value: 'cafe-id', label: 'Caffè' },
    { value: 'oil-id', label: 'Olio extra vergine di oliva' },
  ]
  expect(matchingChoices(choices, 'CAFFE')).toEqual([choices[0]])
  expect(matchingChoices(choices, 'olio oliva')).toEqual([choices[1]])
  expect(matchingChoices(choices, 'pomodoro')).toEqual([])
})
it('mescola ricette e alimenti in ordine alfabetico e distingue gli omonimi', () => {
  expect(
    matchingChoices(
      [
        { value: 'recipe-z', label: 'Zuppa', kind: 'Ricetta' },
        { value: 'recipe-c', label: 'Caffè', kind: 'Ricetta' },
        { value: 'food-c', label: 'Caffè', kind: 'Alimento' },
        { value: 'food-a', label: 'Albicocche', kind: 'Alimento' },
      ],
      '',
    ).map((c) => c.value),
  ).toEqual(['food-a', 'food-c', 'recipe-c', 'recipe-z'])
  expect(matchingChoices([], 'latte')).toEqual([])
})
