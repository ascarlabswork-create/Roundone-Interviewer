import { Camera, CheckCircle2, Loader2, Mic, RefreshCw, Volume2, Wifi, XCircle, AlertTriangle } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { networkCheck, type DeviceCheck as Check } from '../../lib/interviewLobby.ts'
import { classifyMediaError, MEDIA_ERROR_MESSAGES } from '../../services/interviewCall.ts'
import { Button } from '../ui/Button.tsx'

const MIC_SOUND_THRESHOLD = 0.04

function mediaFailure(error: unknown): Check {
  return { state: 'fail', detail: MEDIA_ERROR_MESSAGES[classifyMediaError(error)] }
}

function playTestTone() {
  const context = new AudioContext()
  const gain = context.createGain()
  gain.connect(context.destination)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.2)
  const tone = context.createOscillator()
  tone.frequency.value = 660
  tone.connect(gain)
  tone.start()
  tone.stop(context.currentTime + 1.2)
  window.setTimeout(() => void context.close().catch(() => {}), 1500)
}

/**
 * Local camera, microphone, speaker and network checks for the pre-interview lobby.
 * Nothing is published; devices are released when the lobby closes so the call can use them.
 */
export function DeviceChecks({ latencyMs }: { latencyMs: number | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [camera, setCamera] = useState<Check>({ state: 'checking', detail: 'Starting camera…' })
  const [mic, setMic] = useState<Check>({ state: 'checking', detail: 'Starting microphone…' })
  const [level, setLevel] = useState(0)
  const [speaker, setSpeaker] = useState<Check>({ state: 'warn', detail: 'Play the test sound to check your speakers.' })
  const [speakerPlayed, setSpeakerPlayed] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const streams: MediaStream[] = []
    let audioContext: AudioContext | null = null
    let frame = 0
    let heardSound = false

    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => {
        setCamera({ state: 'fail', detail: 'This browser cannot access a camera. Use a recent Chrome, Edge, Firefox or Safari.' })
        setMic({ state: 'fail', detail: 'This browser cannot access a microphone.' })
      })
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streams.push(stream)
        if (videoRef.current) videoRef.current.srcObject = stream
        const label = stream.getVideoTracks()[0]?.label
        setCamera({ state: 'ok', detail: label ? `Camera working (${label})` : 'Camera working' })
      })
      .catch((error: unknown) => {
        if (!cancelled) setCamera(mediaFailure(error))
      })

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streams.push(stream)
        setMic({ state: 'warn', detail: 'Microphone connected. Say something to test it.' })
        audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        audioContext.createMediaStreamSource(stream).connect(analyser)
        const samples = new Uint8Array(analyser.fftSize)
        const measure = () => {
          analyser.getByteTimeDomainData(samples)
          let sum = 0
          for (const sample of samples) {
            const centered = (sample - 128) / 128
            sum += centered * centered
          }
          const rms = Math.sqrt(sum / samples.length)
          setLevel(Math.min(1, rms * 4))
          if (!heardSound && rms > MIC_SOUND_THRESHOLD) {
            heardSound = true
            setMic({ state: 'ok', detail: 'Microphone working — we can hear you.' })
          }
          frame = requestAnimationFrame(measure)
        }
        measure()
      })
      .catch((error: unknown) => {
        if (!cancelled) setMic(mediaFailure(error))
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()))
      void audioContext?.close().catch(() => {})
    }
  }, [attempt])

  function testSpeaker() {
    try {
      playTestTone()
      setSpeakerPlayed(true)
      setSpeaker({ state: 'warn', detail: 'Did you hear the test sound?' })
    } catch {
      setSpeaker({ state: 'fail', detail: 'Could not play sound in this browser.' })
    }
  }

  const network = networkCheck(online, latencyMs)

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-navy-800">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        {camera.state !== 'ok' ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white/70">
            {camera.state === 'checking' ? 'Starting camera…' : 'Camera preview unavailable'}
          </div>
        ) : null}
      </div>

      <CheckRow icon={<Camera className="h-4 w-4" />} label="Camera" check={camera} />
      <CheckRow icon={<Mic className="h-4 w-4" />} label="Microphone" check={mic}>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      </CheckRow>
      <CheckRow icon={<Volume2 className="h-4 w-4" />} label="Speakers" check={speaker}>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={testSpeaker}>
            Play test sound
          </Button>
          {speakerPlayed && speaker.state !== 'ok' ? (
            <>
              <Button size="sm" onClick={() => setSpeaker({ state: 'ok', detail: 'Speakers working' })}>
                I heard it
              </Button>
              <Button
                size="sm"
                variant="inverse"
                onClick={() =>
                  setSpeaker({ state: 'fail', detail: 'Check your volume and output device, then play the sound again.' })
                }
              >
                I didn&apos;t hear it
              </Button>
            </>
          ) : null}
        </div>
      </CheckRow>
      <CheckRow icon={<Wifi className="h-4 w-4" />} label="Connection" check={network} />

      {camera.state === 'fail' || mic.state === 'fail' ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setCamera({ state: 'checking', detail: 'Starting camera…' })
            setMic({ state: 'checking', detail: 'Starting microphone…' })
            setAttempt((value) => value + 1)
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Check devices again
        </Button>
      ) : null}
    </div>
  )
}

function CheckRow({ icon, label, check, children }: { icon: ReactNode; label: string; check: Check; children?: ReactNode }) {
  const status = {
    checking: <Loader2 className="h-4 w-4 animate-spin text-white/60" aria-label="Checking" />,
    ok: <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-label="Working" />,
    warn: <AlertTriangle className="h-4 w-4 text-amber-300" aria-label="Needs attention" />,
    fail: <XCircle className="h-4 w-4 text-red-400" aria-label="Not working" />,
  }[check.state]
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-white/70">{icon}</span>
        <span className="font-medium text-white">{label}</span>
        <span className="ml-auto">{status}</span>
      </div>
      <p className="mt-1 text-xs text-white/60">{check.detail}</p>
      {children}
    </div>
  )
}
