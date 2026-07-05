import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

interface QuestionBrief {
  prompt: string;
  topic: string;
  difficulty: number;
}

export interface VoiceSessionConfig {
  field: string;
  role?: string;
  difficulty?: number;
  questions?: QuestionBrief[];
  firstQuestion?: string;
}

export function useVoiceInterviewer(sessionId: string, initialPrompt?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiText, setAiText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [difficulty, setDifficulty] = useState(1);

  const audioContext = useRef<AudioContext | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const speechRecognition = useRef<any>(null);
  const playbackQueue = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const interimTranscript = useRef('');
  const currentSessionId = useRef(sessionId);
  const currentQuestion = useRef(initialPrompt || '');
  const socketRef = useRef<Socket | null>(null);   // always-current socket ref
  const isPendingStop = useRef(false);              // prevents double-send

  useEffect(() => {
    currentQuestion.current = initialPrompt || '';
  }, [initialPrompt]);

  // ── Audio decode helper ───────────────────────────────────────────────
  const decodeAudio = useCallback(async (base64: string, mimeType: string): Promise<AudioBuffer | null> => {
    if (!audioContext.current) return null;

    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const isPcm = mimeType.includes('pcm') || mimeType.includes('L16') || mimeType.includes('l16');

    if (!isPcm) {
      // MP3 / WAV — browser decodes natively
      try {
        return await audioContext.current.decodeAudioData(bytes.buffer.slice(0));
      } catch {
        // If MP3 decode fails, try PCM as fallback
        console.warn('[Voice] MP3 decode failed, trying PCM interpretation');
      }
    }

    // PCM L16 (signed 16-bit, little-endian) — manual conversion to float32
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = (int16[i] as number) / 32768.0;
    }
    // Extract sample rate from mime string e.g. "audio/L16;codec=pcm;rate=24000"
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch && rateMatch[1] ? parseInt(rateMatch[1], 10) : 24000;
    const buffer = audioContext.current.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);
    return buffer;
  }, []);

  // ── Playback queue ────────────────────────────────────────────────────
  const playNextChunk = useCallback(() => {
    if (isPlayingRef.current || playbackQueue.current.length === 0 || !audioContext.current) return;

    setIsPlaying(true);
    isPlayingRef.current = true;

    const audioBuffer = playbackQueue.current.shift()!;
    const source = audioContext.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      if (playbackQueue.current.length === 0) {
        setIsPlaying(false);
      } else {
        playNextChunk();
      }
    };
    source.start(0);
  }, []);

  // ── Socket init ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const token = localStorage.getItem('ai_coach_token');
    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('[Voice] Connected to VoiceGateway');
    });

    newSocket.on('voice_error', (data) => {
      setError(data.message);
      setIsProcessing(false);
    });

    newSocket.on('voice_session_started', () => {
      setIsVoiceMode(true);
      setIsProcessing(true);
    });

    newSocket.on('ai_text', (data) => {
      setAiText(data.text || '');
    });

    newSocket.on('audio_response', async (data) => {
      setIsProcessing(false);
      if (!audioContext.current) return;

      try {
        const audioBuffer = await decodeAudio(data.delta, data.mimeType || 'audio/mp3');
        if (audioBuffer) {
          playbackQueue.current.push(audioBuffer);
          playNextChunk();
        }
      } catch (e: any) {
        console.error('[Voice] Failed to decode audio:', e.message, 'mimeType:', data.mimeType);
        setError('Failed to play audio response');
      }
    });

    currentSessionId.current = sessionId;
    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId, decodeAudio, playNextChunk]);

  // ── Start voice session ───────────────────────────────────────────────
  const startVoiceSession = useCallback(
    async (config?: VoiceSessionConfig) => {
      setError(null);
      if (!socket || isVoiceMode) return;

      // AudioContext must be created on a user gesture
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume();
      }

      socket.emit('start_voice_session', {
        sessionId: currentSessionId.current,
        field: config?.field || 'Full-stack Engineering',
        role: config?.role || config?.field || 'Full-stack Engineer',
        difficulty: config?.difficulty || 1,
        questions: config?.questions || [],
        firstQuestion: config?.firstQuestion || initialPrompt || 'Tell me about a recent technical challenge you faced.',
      });
    },
    [socket, initialPrompt, isVoiceMode],
  );

  // ── Recording ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContext.current.state === 'suspended') {
      await audioContext.current.resume();
    }

    try {
      mediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const source = audioContext.current.createMediaStreamSource(mediaStream.current);
      const processor = audioContext.current.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquares += (inputData[i] as number) * (inputData[i] as number);
        }
        setVolume(Math.min(1, Math.sqrt(sumSquares / inputData.length) * 25));
      };
      source.connect(processor);
      processor.connect(audioContext.current.destination);
      processorRef.current = processor;

      // Browser SpeechRecognition for STT
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const sr = new SpeechRecognition();
        sr.continuous = true;
        sr.interimResults = true;

        sr.onresult = (event: any) => {
          let finalText = '';
          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalText += event.results[i][0].transcript;
            } else {
              interimText += event.results[i][0].transcript;
            }
          }
          interimTranscript.current += finalText;
          setTranscript(interimTranscript.current + (interimText ? ' ' + interimText : ''));
        };

        sr.onerror = (e: any) => {
          // 'no-speech' is harmless — user just didn't say anything yet
          if (e.error !== 'no-speech') {
            console.warn('[Voice] SpeechRecognition error:', e.error);
          }
        };

        // KEY FIX: onend fires AFTER final onresult events have been delivered.
        // This is where we safely read the complete transcript and send it.
        sr.onend = () => {
          if (!isPendingStop.current) return; // only act if we triggered the stop
          isPendingStop.current = false;

          const finalTranscript = interimTranscript.current.trim();
          setIsRecording(false);
          setVolume(0);

          if (finalTranscript && socketRef.current) {
            console.log('[Voice] Sending transcript:', finalTranscript.slice(0, 60));
            setIsProcessing(true);
            socketRef.current.emit('voice_turn', {
              transcript: finalTranscript,
              sessionId: currentSessionId.current,
              currentQuestion: currentQuestion.current,
            });
          } else {
            // Nothing to send — just make sure UI resets cleanly
            setIsRecording(false);
          }
        };

        sr.start();
        speechRecognition.current = sr;
      } else {
        setError('Your browser does not support speech recognition. Try Chrome or Edge.');
      }

      setTranscript('');
      interimTranscript.current = '';
      setIsRecording(true);
    } catch (err: any) {
      setError('Microphone access denied: ' + err.message);
    }
  };

  const stopRecording = useCallback(() => {
    // Signal onend to send the transcript once final results arrive
    isPendingStop.current = true;

    if (speechRecognition.current) {
      try { speechRecognition.current.stop(); } catch (e) {}
      // NOTE: do NOT null speechRecognition.current here — onend still needs to fire
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach((t) => t.stop());
      mediaStream.current = null;
    }
    // isRecording + volume are reset inside sr.onend after transcript is sent
  }, []);

  const endVoiceSession = useCallback(() => {
    if (socket) {
      socket.emit('end_voice_session', { sessionId: currentSessionId.current });
    }
  }, [socket]);

  return {
    isVoiceMode,
    startVoiceSession,
    startRecording,
    stopRecording,
    endVoiceSession,
    isRecording,
    isPlaying,
    transcript,
    aiText,
    error,
    volume,
    isProcessing,
    difficulty,
    difficultyLabel: DIFFICULTY_LABELS[difficulty] || 'Easy',
    setTranscript,
  };
}
