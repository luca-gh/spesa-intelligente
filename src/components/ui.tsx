import type { FormEvent, ReactNode } from 'react'
import { useApp } from '../data/context'
import { units } from '../domain/math'
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden="true">
        ↗
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
export function Field({
  label,
  name,
  type = 'text',
  value,
  required = true,
  placeholder,
  min,
  max,
  step,
}: {
  label: string
  name: string
  type?: string
  value?: string | number
  required?: boolean
  placeholder?: string
  min?: number
  max?: number
  step?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        maxLength={type === 'password' ? 200 : 2000}
      />
    </label>
  )
}
export function Select({
  label,
  name,
  children,
  value,
  required = true,
}: {
  label: string
  name: string
  children: ReactNode
  value?: string
  required?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={value} required={required}>
        {children}
      </select>
    </label>
  )
}
export function UnitSelect({ value = 'pz' }: { value?: string }) {
  return (
    <Select label="Unità" name="unit" value={value}>
      {units.map((u) => (
        <option key={u}>{u}</option>
      ))}
    </Select>
  )
}
export function Submit({ children = 'Salva' }: { children?: ReactNode }) {
  const { busy, online } = useApp()
  return (
    <button className="button" type="submit" disabled={busy || !online}>
      {busy ? 'Salvataggio…' : children}
    </button>
  )
}
export function Form({
  onSave,
  children,
  className = '',
}: {
  onSave: (data: FormData) => Promise<unknown>
  children: ReactNode
  className?: string
}) {
  const { act } = useApp()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    void act(() => onSave(values)).then((ok) => {
      if (ok) form.reset()
    })
  }
  return (
    <form className={`form ${className}`} onSubmit={submit}>
      {children}
    </form>
  )
}
export const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  )
}
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
export function ConfirmButton({
  children,
  onConfirm,
  message,
}: {
  children: ReactNode
  onConfirm: () => Promise<unknown>
  message: string
}) {
  const { act, busy, online } = useApp()
  return (
    <button
      className="text-button"
      disabled={busy || !online}
      onClick={() => {
        if (window.confirm(message)) void act(onConfirm)
      }}
    >
      {children}
    </button>
  )
}
