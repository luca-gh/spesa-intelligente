import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../data/context'
import { matchingChoices, type SearchChoice } from '../domain/choices'

export function SearchSelect({
  label,
  name,
  choices,
  value: controlledValue,
  query: controlledQuery,
  onSelect,
  onQueryChange,
  required = true,
  disabled: externallyDisabled = false,
  className = '',
  helpText = 'Scrivi il nome e seleziona un risultato.',
  placeholder = 'Scrivi per cercare…',
  emptyText,
}: {
  label: string
  name: string
  choices: SearchChoice[]
  value?: string
  query?: string
  onSelect?: (value: string) => void
  onQueryChange?: (query: string) => void
  required?: boolean
  disabled?: boolean
  className?: string
  helpText?: string
  placeholder?: string
  emptyText?: string
}) {
  const { busy, online } = useApp()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [internalQuery, setInternalQuery] = useState('')
  const [internalValue, setInternalValue] = useState('')
  const query = controlledQuery ?? internalQuery
  const value = controlledValue ?? internalValue
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const selected = choices.find((choice) => choice.value === value)
  const results = matchingChoices(choices, selected ? '' : query)
  const disabled = externallyDisabled || busy || !online
  const expanded = open && !disabled
  const activeIndex = Math.min(active, results.length - 1)
  const optionId = (index: number) => `${id}-option-${index}`

  useEffect(() => {
    input.current?.setCustomValidity(
      required && !selected && query ? 'Seleziona una voce tra i risultati suggeriti.' : '',
    )
  }, [selected, query, required])
  useEffect(() => {
    const form = input.current?.form
    const reset = () => {
      setInternalQuery('')
      setInternalValue('')
      onQueryChange?.('')
      onSelect?.('')
      setOpen(false)
      setActive(-1)
      input.current?.setCustomValidity('')
    }
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [onQueryChange, onSelect])
  useEffect(() => {
    const outside = (event: PointerEvent | FocusEvent) => {
      // A keyboard dismissal can blur the input before a touch click selects an option.
      // Close on an actual outside interaction instead of unmounting options on blur.
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false)
        setActive(-1)
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
    }
  }, [])
  useEffect(() => {
    if (expanded && activeIndex >= 0)
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [expanded, activeIndex, id, query])

  function choose(choice: SearchChoice) {
    setInternalValue(choice.value)
    setInternalQuery(choice.label)
    onSelect?.(choice.value)
    onQueryChange?.(choice.label)
    input.current?.setCustomValidity('')
    input.current?.focus({ preventScroll: true })
    setOpen(false)
    setActive(-1)
  }
  return (
    <div className={`field search-select ${className}`} ref={root}>
      <label htmlFor={id}>{label}</label>
      <input type="hidden" name={name} value={selected?.value ?? ''} disabled={disabled} />
      <input
        ref={input}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? `${id}-results` : undefined}
        aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-describedby={`${id}-help`}
        value={selected?.label ?? query}
        required={required}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        maxLength={200}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setInternalQuery(event.target.value)
          setInternalValue('')
          onQueryChange?.(event.target.value)
          onSelect?.('')
          setActive(-1)
          setOpen(true)
          event.currentTarget.setCustomValidity(
            required && event.target.value ? 'Seleziona una voce tra i risultati suggeriti.' : '',
          )
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            setActive(
              event.key === 'ArrowDown'
                ? Math.min(activeIndex + 1, results.length - 1)
                : activeIndex <= 0
                  ? results.length - 1
                  : activeIndex - 1,
            )
          } else if (event.key === 'Enter' && expanded && results.length) {
            event.preventDefault()
            choose(results[activeIndex >= 0 ? activeIndex : 0])
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
            setActive(-1)
          } else if (event.key === 'Tab') {
            setOpen(false)
            setActive(-1)
          }
        }}
      />
      <small className="muted" id={`${id}-help`}>
        {helpText}
      </small>
      {expanded && (
        <div className="search-select-popup">
          <ul id={`${id}-results`} role="listbox" aria-label={`Suggerimenti per ${label}`}>
            {results.map((choice, index) => (
              <li
                key={choice.value}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'active' : ''}
                onPointerDown={(event) => {
                  // Keep mouse focus in the combobox; let touch gestures scroll normally.
                  if (event.pointerType === 'mouse') event.preventDefault()
                }}
                onClick={() => choose(choice)}
              >
                <span>{choice.label}</span>
                {choice.kind && <small>{choice.kind}</small>}
              </li>
            ))}
          </ul>
          {!results.length && (
            <p role="status">
              {emptyText ??
                (choices.length
                  ? 'Nessun risultato. Prova un altro nome.'
                  : 'Nessuna voce disponibile. Aggiungi un prodotto al Catalogo o una ricetta.')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
