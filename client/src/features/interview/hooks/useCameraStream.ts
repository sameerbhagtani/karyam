import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseCameraStreamReturn {
  isCameraOn: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  error: string | null
  toggleCamera: () => Promise<void>
  stopCamera: () => void
}

export const useCameraStream = (): UseCameraStreamReturn => {
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOn(false)
  }, [])

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      stopCamera()
      return
    }

    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }

      setIsCameraOn(true)
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings.'
          : 'Could not access webcam. Please check your video device.'
      setError(message)
      setIsCameraOn(false)
    }
  }, [isCameraOn, stopCamera])

  // Attach stream whenever videoRef attaches or stream changes
  useEffect(() => {
    if (isCameraOn && streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [isCameraOn])

  // Cleanup tracks on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    isCameraOn,
    videoRef,
    error,
    toggleCamera,
    stopCamera,
  }
}
