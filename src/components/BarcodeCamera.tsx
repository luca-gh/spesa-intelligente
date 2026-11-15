import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { validBarcode } from '../domain/math'

interface Detector {
  detect(video: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
type DetectorType = {
  new (options: { formats: string[] }): Detector
  getSupportedFormats?: () => Promise<string[]>
}

export function BarcodeCamera({
  onDetected,
  disabled = false,
}: {
  onDetected: (code: string) => void
  disabled?: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const controls = useRef<{ stop: () => void } | null>(null)
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const callback = useRef(onDetected)
  useEffect(() => {
    callback.current = onDetected
  }, [onDetected])
  const [active, setActive] = useState(false)
  const [message, setMessage] = useState('')
  const release = useCallback(() => {
    generation.current++
    clearTimeout(timer.current)
    controls.current?.stop()
    controls.current = null
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    if (video.current) video.current.srcObject = null
  }, [])
  useEffect(() => () => release(), [release])
  useEffect(() => {
    if (disabled) {
      release()
      void Promise.resolve().then(() => setActive(false))
    }
  }, [disabled, release])
  function stop() {
    release()
    setActive(false)
  }
  async function start() {
    release()
    const current = generation.current
    setMessage('')
    setActive(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('Fotocamera non disponibile')
      const captured = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      if (current !== generation.current) {
        captured.getTracks().forEach((track) => track.stop())
        return
      }
      stream.current = captured
      const preview = video.current
      if (!preview) throw Error('Anteprima non disponibile')
      preview.srcObject = captured
      await preview.play()
      if (current !== generation.current) return
      const found = (code: string) => {
        if (current !== generation.current || !validBarcode(code)) return
        stop()
        callback.current(code)
      }
      const native = (window as unknown as { BarcodeDetector?: DetectorType }).BarcodeDetector
      let detector: Detector | undefined
      if (native) {
        try {
          const supported = await native.getSupportedFormats?.()
          if (!supported || ['ean_8', 'ean_13'].every((format) => supported.includes(format)))
            detector = new native({ formats: ['ean_8', 'ean_13'] })
        } catch {
          /* Use the bundled decoder. */
        }
      }
      if (current !== generation.current) return
      if (detector) {
        const read = async () => {
          if (current !== generation.current) return
          try {
            const results = await detector.detect(preview)
            const result = results.find((item) => validBarcode(item.rawValue))
            if (result) {
              found(result.rawValue)
              return
            }
          } catch {
            /* Retry while the camera focuses. */
          }
          if (current === generation.current) timer.current = setTimeout(() => void read(), 180)
        }
        void read()
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        if (current !== generation.current) return
        const reader = new BrowserMultiFormatReader(
          new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_8, BarcodeFormat.EAN_13]]]),
        )
        const running = await reader.decodeFromStream(captured, preview, (result, _error, scanner) => {
          if (result && validBarcode(result.getText())) {
            scanner.stop()
            found(result.getText())
          }
        })
        if (current !== generation.current) running.stop()
        else controls.current = running
      }
    } catch {
      if (current !== generation.current) return
      stop()
      setMessage('Fotocamera non disponibile o permesso negato. Puoi inserire il codice manualmente.')
    }
  }
  return (
    <div className="form">
      <video
        ref={video}
        muted
        playsInline
        className={active ? 'camera' : 'camera hidden'}
        aria-label="Anteprima fotocamera barcode"
      />
      <div className="inline">
        <button
          type="button"
          className="button secondary"
          disabled={disabled || active}
          onClick={() => void start()}
        >
          <Camera size={18} /> Scansiona barcode
        </button>
        {active && (
          <button type="button" className="text-button" onClick={stop}>
            Ferma fotocamera
          </button>
        )}
      </div>
      {active && <p role="status">Inquadra il codice a barre. La lettura avviene sul dispositivo.</p>}
      {message && <p role="status">{message}</p>}
    </div>
  )
}
