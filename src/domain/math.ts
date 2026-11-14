import Decimal from 'decimal.js'

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP })
export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'pz' | 'conf'
export const units: Unit[] = ['g', 'kg', 'ml', 'L', 'pz', 'conf']
const dimensions: Record<Unit, [string, number]> = {
  g: ['mass', 1],
  kg: ['mass', 1000],
  ml: ['volume', 1],
  L: ['volume', 1000],
  pz: ['piece', 1],
  conf: ['pack', 1],
}
export function quantity(value: string | number): Decimal {
  const parsed = new Decimal(String(value).trim().replace(',', '.'))
  if (!parsed.isFinite() || parsed.isNegative()) throw new Error('Quantità o importo non valido.')
  return parsed
}
export function money(value: string | number | Decimal): string {
  return new Decimal(value).toFixed(2)
}
export function euro(value: string | number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value))
}
export function convert(value: string | number, from: Unit, to: Unit): Decimal {
  if (dimensions[from][0] !== dimensions[to][0]) throw new Error('Unità non compatibili.')
  return quantity(value).mul(dimensions[from][1]).div(dimensions[to][1])
}
export function packages(
  requested: string | number,
  unit: Unit,
  size: string | number,
  packageUnit: Unit,
): number {
  if (quantity(size).isZero()) throw new Error('Il formato deve essere maggiore di zero.')
  return convert(requested, unit, packageUnit).div(quantity(size)).ceil().toNumber()
}
export function remaining(requested: string | number, purchased: string | number) {
  const difference = quantity(requested).minus(quantity(purchased))
  return {
    remaining: Decimal.max(0, difference).toString(),
    surplus: Decimal.max(0, difference.neg()).toString(),
  }
}
export function scale(value: string | number, base: number, servings: number, discrete = false): string {
  if (base <= 0 || servings <= 0) throw new Error('Le porzioni devono essere positive.')
  const result = quantity(value).mul(servings).div(base)
  return (discrete ? result.ceil() : result.toDecimalPlaces(3)).toString()
}
export function dateInZone(instant = new Date(), zone = 'Europe/Rome'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}
export function validBarcode(code: string): boolean {
  if (!/^(\d{8}|\d{13})$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  return (
    (10 - (digits.reverse().reduce((sum, n, i) => sum + n * (i % 2 === 0 ? 3 : 1), 0) % 10)) % 10 === check
  )
}
