import Decimal from 'decimal.js'
import type { Store } from '../data/types'

export function isPam(store: Pick<Store, 'name' | 'chain'>) {
  return /\bpam\b/i.test(`${store.name} ${store.chain ?? ''}`)
}
export function pamDiscount(store: Pick<Store, 'name' | 'chain' | 'pam_discount_enabled'>) {
  return isPam(store) && store.pam_discount_enabled === true
}
export function storePrice(
  amount: string,
  store: Pick<Store, 'name' | 'chain' | 'pam_discount_enabled'>,
  round = true,
) {
  const discounted = new Decimal(amount).mul(pamDiscount(store) ? '0.9' : '1')
  return round ? discounted.toFixed(2) : discounted.toString()
}
