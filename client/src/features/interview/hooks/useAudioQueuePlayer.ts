import { useState, useRef, useCallback, useEffect } from 'react'
import type { SseAudioChunkEvent } from '../../../shared/types/interview.types'

interface AudioQueueItem {
  id: number
  chunk: string
  text: string
}

interface UseAudioQueuePlayerOptions {
  onAllPlaybackEnded?: () => void
}

export const useAudioQueuePlayer = (options?: UseAudioQueuePlayerOptions) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('')
  const [spokenSentences, setSpokenSentences] = useState<string[]>([])
  const [queueLength, setQueueLength] = useState<number>(0)
  const [audioLevel, setAudioLevel] = useState<number>(0) // 0 to 1 for waveform pulse

  const queueRef = useRef<AudioQueueItem[]>([])
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const isPlayingRef = useRef<boolean>(false)
  const isStreamDoneRef = useRef<boolean>(false)
  const nextIdRef = useRef<number>(1)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const isMutedRef = useRef<boolean>(false)
  isMutedRef.current = isMuted

  const pulseIntervalRef = useRef<number | null>(null)

  const stopPulse = useCallback(() => {
    if (pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current)
      pulseIntervalRef.current = null
    }
    setAudioLevel(0)
  }, [])

  const startPulse = useCallback(() => {
    stopPulse()
    pulseIntervalRef.current = window.setInterval(() => {
      // Speech amplitude modulation between 0.35 and 0.95
      const randomLevel = 0.35 + Math.random() * 0.6
      setAudioLevel(randomLevel)
    }, 120)
  }, [stopPulse])

  const playNextRef = useRef<() => void>(() => {})

  const playNext = useCallback((): void => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false
      setIsPlaying(false)
      stopPulse()
      setQueueLength(0)

      if (isStreamDoneRef.current) {
        optionsRef.current?.onAllPlaybackEnded?.()
      }
      return
    }

    const nextItem = queueRef.current.shift()!
    setQueueLength(queueRef.current.length)
    isPlayingRef.current = true
    setIsPlaying(true)
    setCurrentSubtitle(nextItem.text)

    if (nextItem.text && nextItem.text.trim()) {
      const trimmed = nextItem.text.trim()
      setSpokenSentences((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === trimmed) {
          return prev
        }
        return [...prev, trimmed]
      })
    }

    try {
      const audioSrc = `data:audio/wav;base64,${nextItem.chunk}`
      const audio = new Audio(audioSrc)
      audio.muted = isMutedRef.current
      currentAudioRef.current = audio

      startPulse()

      audio.onended = () => {
        currentAudioRef.current = null
        playNextRef.current()
      }

      audio.onerror = (e) => {
        console.warn('Audio playback error on chunk, skipping to next:', e)
        currentAudioRef.current = null
        playNextRef.current()
      }

      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Autoplay prevented or audio playback rejected:', err)
          currentAudioRef.current = null
          playNextRef.current()
        })
      }
    } catch (err) {
      console.error('Failed to create audio element:', err)
      playNextRef.current()
    }
  }, [startPulse, stopPulse])

  useEffect(() => {
    playNextRef.current = playNext
  }, [playNext])

  const enqueueChunk = useCallback(
    (event: SseAudioChunkEvent) => {
      if (!event.chunk) return

      const item: AudioQueueItem = {
        id: nextIdRef.current++,
        chunk: event.chunk,
        text: event.text || '',
      }

      queueRef.current.push(item)
      setQueueLength(queueRef.current.length)

      if (!isPlayingRef.current) {
        playNext()
      }
    },
    [playNext]
  )

  const markStreamDone = useCallback(() => {
    isStreamDoneRef.current = true
    if (!isPlayingRef.current && queueRef.current.length === 0) {
      optionsRef.current?.onAllPlaybackEnded?.()
    }
  }, [])

  const stopAll = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    queueRef.current = []
    isPlayingRef.current = false
    isStreamDoneRef.current = false
    setIsPlaying(false)
    setCurrentSubtitle('')
    setQueueLength(0)
    stopPulse()
  }, [stopPulse])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      if (currentAudioRef.current) {
        currentAudioRef.current.muted = next
      }
      return next
    })
  }, [])

  const resetQueue = useCallback(() => {
    stopAll()
    setSpokenSentences([])
    setCurrentSubtitle('')
  }, [stopAll])

  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [stopAll])

  return {
    isPlaying,
    isMuted,
    currentSubtitle,
    spokenSentences,
    queueLength,
    audioLevel,
    enqueueChunk,
    markStreamDone,
    stopAll,
    resetQueue,
    toggleMute,
  }
}
