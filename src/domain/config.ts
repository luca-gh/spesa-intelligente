/** Reject privileged keys before they can enter a browser bundle. No key value is included in errors. */
export function isPrivilegedKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) return true
  try {
    const payload = value.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    return !!payload && JSON.parse(atob(payload)).role === 'service_role'
  } catch {
    return false
  }
}
export function assertPublicEnvironment(values: Record<string, string>) {
  if (Object.values(values).some(isPrivilegedKey)) {
    throw new Error('Configurazione rifiutata: una variabile pubblica contiene una chiave privilegiata.')
  }
}
