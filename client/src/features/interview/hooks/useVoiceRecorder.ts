import { useState, useRef, useCallback, useEffect } from 'react'

const MAX_RECORDING_SECONDS = 300 // Max candidate recording time: 5 minutes (seamlessly segmented by backend STT)

interface UseVoiceRecorderOptions {
  /** Called when the recording auto-stops at MAX_RECORDING_SECONDS */
  onAutoStop?: () => void
}

interface UseVoiceRecorderReturn {
  isRecording: boolean
  duration: number
  micVolume: number // 0 to 1
  permissionError: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | null>
  cancelRecording: () => void
}

export const useVoiceRecorder = (options?: UseVoiceRecorderOptions): UseVoiceRecorderReturn => {
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [duration, setDuration] = useState<number>(0)
  const [micVolume, setMicVolume] = useState<number>(0)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<number | null>(null)
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mimeTypeRef = useRef<string>('audio/webm')
  const onAutoStopRef = useRef(options?.onAutoStop)

  // Keep ref fresh without adding to callback deps
  useEffect(() => {
    onAutoStopRef.current = options?.onAutoStop
  }, [options?.onAutoStop])

  // Clean up audio context and animation frame
  const cleanupAudioAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    setMicVolume(0)
  }, [])

  // Setup Web Audio AnalyserNode to sample volume
  const setupAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateVolume = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)

        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const average = sum / dataArray.length
        const normalized = Math.min(1, Math.max(0, average / 128))
        setMicVolume(normalized)

        animFrameRef.current = requestAnimationFrame(updateVolume)
      }

      updateVolume()
    } catch (e) {
      console.warn('AudioContext analyser not supported or blocked:', e)
    }
  }, [])

  const startRecording = useCallback(
    async () => {
      setPermissionError(null)
      setDuration(0)
      audioChunksRef.current = []

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        streamRef.current = stream

        // Pick best supported MIME type
        let mimeType = 'audio/webm'
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus'
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm'
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4'
          } else if (MediaRecorder.isTypeSupported('audio/wav')) {
            mimeType = 'audio/wav'
          }
        }
        mimeTypeRef.current = mimeType

        const recorder = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        // Start capturing in 250ms time slices
        recorder.start(250)
        setIsRecording(true)

        // Start volume analysis
        setupAudioAnalyser(stream)

        // Start duration counter
        timerIntervalRef.current = window.setInterval(() => {
          setDuration((prev) => prev + 1)
        }, 1000)

        // Auto-stop at MAX_RECORDING_SECONDS to stay within Sarvam STT limit
        autoStopTimeoutRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            // Notify parent so it can call stopRecording + submit
            onAutoStopRef.current?.()
          }
        }, MAX_RECORDING_SECONDS * 1000)
      } catch (err: unknown) {
        console.error('Microphone access failed:', err)
        const message =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Microphone permission was denied. Please allow microphone access in your browser settings.'
            : 'Could not access microphone. Please check your audio device.'
        setPermissionError(message)
        throw new Error(message)
      }
    },
    [setupAudioAnalyser]
  )

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current)
        autoStopTimeoutRef.current = null
      }

      cleanupAudioAnalyser()

      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
        resolve(null)
        return
      }

      recorder.onstop = () => {
        const mime = mimeTypeRef.current || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mime })
        audioChunksRef.current = []

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }

        setIsRecording(false)
        resolve(audioBlob)
      }

      recorder.stop()
    })
  }, [cleanupAudioAnalyser])

  const cancelRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current)
      autoStopTimeoutRef.current = null
    }

    cleanupAudioAnalyser()

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // ignore
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    audioChunksRef.current = []
    setIsRecording(false)
    setDuration(0)
  }, [cleanupAudioAnalyser])

  useEffect(() => {
    return () => {
      cancelRecording()
    }
  }, [cancelRecording])

  return {
    isRecording,
    duration,
    micVolume,
    permissionError,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
