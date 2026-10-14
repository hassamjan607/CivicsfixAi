/**
 * useWebSpeech Hook
 * 
 * Custom React hook for Web Speech API integration supporting
 * native Urdu (ur-PK) and English (en-US) speech recognition,
 * with high-clarity voice output synthesis and feedback chimes.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { speakClearPhrase, playChime, stopSpeech, COMMON_PHRASES, SpeechPhrase } from '@/lib/speech'

interface WebSpeechOptions {
  language?: 'ur-PK' | 'en-US'
  continuous?: boolean
  interimResults?: boolean
  onSpeechEnd?: (finalTranscript: string) => void
}

interface WebSpeechReturn {
  transcript: string
  isListening: boolean
  isSpeaking: boolean
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  speakGreeting: () => void
  speak: (phrase: SpeechPhrase) => void
  clearTranscript: () => void
  error: string | null
}

export function useWebSpeech(options: WebSpeechOptions = {}): WebSpeechReturn {
  const {
    language = 'ur-PK',
    continuous = false,
    interimResults = true,
    onSpeechEnd
  } = options

  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)

  const isSupported = typeof window !== 'undefined' && 
    (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window))

  // Initialize SpeechRecognition instance
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass()
        recognition.continuous = continuous
        recognition.interimResults = interimResults
        recognition.lang = language

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
          playChime('listening');
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = ''
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript
          }
          setTranscript(currentTranscript)

          const isFinal = event.results[event.results.length - 1].isFinal
          if (isFinal && onSpeechEnd) {
            onSpeechEnd(currentTranscript)
          }
        }

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition notice:', event.error)
          setError(event.error)
          setIsListening(false)
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
      } catch (err: any) {
        setError(err.message || 'Speech recognition initialization failed')
      }
    }
  }, [language, continuous, interimResults, onSpeechEnd])

  const startListening = useCallback(() => {
    stopSpeech()
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch {
        // Recognition might already be running
        setIsListening(true)
      }
    } else {
      setIsListening(true)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
    }
    setIsListening(false)
    playChime('done')
  }, [])

  const speak = useCallback((phrase: SpeechPhrase) => {
    const langKey = language.startsWith('ur') ? 'ur' : 'en'
    speakClearPhrase(
      phrase,
      langKey,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    )
  }, [language])

  const speakGreeting = useCallback(() => {
    const langKey = language.startsWith('ur') ? 'ur' : 'en'
    playChime('start')
    speakClearPhrase(
      COMMON_PHRASES.HOW_CAN_I_HELP,
      langKey,
      () => {
        setIsSpeaking(true)
      },
      () => {
        setIsSpeaking(false)
        // Automatically activate listening once the greeting concludes
        startListening()
      }
    )
  }, [language, startListening])

  const clearTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    transcript,
    isListening,
    isSpeaking,
    isSupported,
    startListening,
    stopListening,
    speakGreeting,
    speak,
    clearTranscript,
    error
  }
}