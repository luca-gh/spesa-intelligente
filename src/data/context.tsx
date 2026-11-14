import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import Decimal from 'decimal.js'
import { client, safeError } from './client'
import { emptyData, type Data, type Household, type Item } from './types'
import { remaining } from '../domain/math'

interface State {
  data: Data
  household: Household | null
  session: Session | null
  loading: boolean
  busy: boolean
  notice: string
  online: boolean
  sync: string
  refresh: () => Promise<void>
  act: (work: () => Promise<unknown>, success?: string) => Promise<boolean>
  itemQuantity: (item: Item) => { requested: string; bought: string; remaining: string; surplus: string }
}
const Context = createContext<State | null>(null)
export function useApp() {
  const state = useContext(Context)
  if (!state) throw new Error('Provider mancante')
  return state
}
export function Provider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [data, setData] = useState<Data>(emptyData)
  const [household, setHousehold] = useState<Household | null>(null)
  const [loading, setLoading] = useState(!!client)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [notice, setNotice] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [sync, setSync] = useState('Non connesso')
  const generation = useRef(0)
  useEffect(() => {
    if (!notice) return
    // Short confirmations disappear quickly; longer messages get time to be read.
    const duration = Math.min(12_000, Math.max(4_000, notice.length * 60))
    const timer = window.setTimeout(() => setNotice(''), duration)
    return () => window.clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (!client) return
    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        generation.current++
        setData(emptyData)
        setHousehold(null)
        setLoading(false)
      }
    })
    client.auth.getSession().then(({ data: result, error }) => {
      if (error) {
        setNotice(safeError(error))
        setLoading(false)
      } else {
        setSession(result.session)
        if (!result.session) setLoading(false)
      }
    })
    return () => subscription.subscription.unsubscribe()
  }, [])
  const userId = session?.user.id
  const householdId = household?.id
  const refresh = useCallback(async () => {
    if (!client || !userId || !navigator.onLine) return
    const request = ++generation.current
    const result = await client.from('households').select('*').limit(1).maybeSingle()
    if (result.error) throw result.error
    if (request !== generation.current) return
    if (!result.data) {
      setHousehold(null)
      setData(emptyData)
      setLoading(false)
      return
    }
    const h = result.data as Household
    const rows = await Promise.all(
      Object.keys(emptyData).map(async (table) => {
        const { data: records, error } = await client!
          .from(table)
          .select('*')
          .eq('household_id', h.id)
          .limit(10000)
        if (error) throw error
        if (records.length === 10000) throw new Error('Limite dati raggiunto')
        return [table, records]
      }),
    )
    if (request !== generation.current) return
    setHousehold(h)
    setData(Object.fromEntries(rows) as unknown as Data)
    setLoading(false)
  }, [userId])
  useEffect(() => {
    let active = true
    void Promise.resolve()
      .then(() => {
        if (active) return refresh()
      })
      .catch((error) => {
        if (active) {
          setNotice(safeError(error))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [refresh])
  useEffect(() => {
    const connected = () => {
      setOnline(true)
      refresh().catch((error) => setNotice(safeError(error)))
    }
    const disconnected = () => {
      setOnline(false)
      setSync('Offline')
    }
    const focused = () => {
      if (navigator.onLine) refresh().catch((error) => setNotice(safeError(error)))
    }
    window.addEventListener('online', connected)
    window.addEventListener('offline', disconnected)
    window.addEventListener('focus', focused)
    return () => {
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', disconnected)
      window.removeEventListener('focus', focused)
    }
  }, [refresh])
  useEffect(() => {
    if (!client || !householdId || !online) return
    let timer: ReturnType<typeof setTimeout>
    const channel = client
      .channel(`household:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', filter: `household_id=eq.${householdId}` },
        () => {
          clearTimeout(timer)
          timer = setTimeout(() => {
            refresh().catch((error) => setNotice(safeError(error)))
          }, 150)
        },
      )
      .subscribe((status) => {
        setSync(status === 'SUBSCRIBED' ? 'Sincronizzato' : 'Riconnessione…')
        if (status === 'SUBSCRIBED') refresh().catch((error) => setNotice(safeError(error)))
      })
    return () => {
      clearTimeout(timer)
      void client!.removeChannel(channel)
    }
  }, [householdId, online, refresh])
  const act = async (work: () => Promise<unknown>, success = 'Salvato.') => {
    if (busyRef.current) return false
    busyRef.current = true
    setBusy(true)
    setNotice('')
    try {
      await work()
      await refresh()
      setNotice(success)
      return true
    } catch (error) {
      setNotice(safeError(error))
      return false
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const itemQuantity = (item: Item) => {
    const requested = data.list_item_contributions
      .filter((c) => c.item_id === item.id)
      .reduce((s, c) => s.plus(c.requested_quantity), new Decimal(0))
      .toString()
    const bought = data.purchases
      .filter((p) => p.list_item_id === item.id && !p.voided_at)
      .reduce((s, p) => s.plus(p.quantity), new Decimal(0))
      .toString()
    return { requested, bought, ...remaining(requested, bought) }
  }
  return (
    <Context.Provider
      value={{ data, household, session, loading, busy, notice, online, sync, refresh, act, itemQuantity }}
    >
      {children}
    </Context.Provider>
  )
}
