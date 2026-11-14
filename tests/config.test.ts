import { expect, it } from 'vitest'
import { assertPublicEnvironment, isPrivilegedKey } from '../src/domain/config'
it('blocca chiavi privilegiate prima della build senza mostrarle', () => {
  const legacy = 'header.' + btoa(JSON.stringify({ role: 'service_role' })) + '.signature'
  expect(isPrivilegedKey(legacy)).toBe(true)
  expect(() => assertPublicEnvironment({ VITE_KEY: legacy })).toThrow('Configurazione rifiutata')
  expect(() => assertPublicEnvironment({ VITE_KEY: 'sb_secret_test' })).toThrow('Configurazione rifiutata')
  expect(() => assertPublicEnvironment({ VITE_KEY: 'sb_publishable_test' })).not.toThrow()
})
