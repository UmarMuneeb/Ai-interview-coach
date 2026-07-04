import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

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

  useEffect(() => {
    currentQuestion.current = initialPrompt || '';
  }, [initialPrompt]);

  // Initialize Socket.io
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
        // Decode base64 audio — supports MP3 (from Inworld) and PCM (Gemini fallback)
        const base64 = data.delta;
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const mimeType = data.mimeType || 'audio/mp3';
        let audioBuffer: AudioBuffer;

        if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
          // MP3: use decodeAudioData (handles MP3 natively in browsers)
          audioBuffer = await audioContext.current.decodeAudioData(bytes.buffer.slice(0));
        } else {
          // PCM fallback (Gemini): convert 16-bit int16 to float32
          const int16Array = new Int16Array(bytes.buffer);
          const float32Array = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = (int16Array[i] as number) / 32768.0;
          }
          audioBuffer = audioContext.current.createBuffer(1, float32Array.length, 24000);
          audioBuffer.copyToChannel(float32Array, 0);
        }

        playbackQueue.current.push(audioBuffer);
        playNextChunk();
      } catch (e: any) {
        console.error('[Voice] Failed to decode audio:', e.message);
        setError('Failed to play audio response');
      }
    });

    currentSessionId.current = sessionId;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId]);

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

  const startVoiceSession = useCallback(
    async (field?: string, firstQuestion?: string) => {
      setError(null);
      if (!socket) return;

      // Create AudioContext on user gesture (required by browsers)
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume();
      }

      socket.emit('start_voice_session', {
        sessionId: currentSessionId.current,
        field: field || 'Full-stack Engineering',
        firstQuestion: firstQuestion || initialPrompt || 'Tell me about a recent technical challenge you faced.',
      });
    },
    [socket, initialPrompt],
  );

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
        const rms = Math.sqrt(sumSquares / inputData.length);
        setVolume(Math.min(1, rms * 25)); // boosted sensitivity
      };

      source.connect(processor);
      processor.connect(audioContext.current.destination);
      processorRef.current = processor;

      // Browser SpeechRecognition for STT
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        speechRecognition.current = new SpeechRecognition();
        speechRecognition.current.continuous = true;
        speechRecognition.current.interimResults = true;
        speechRecognition.current.onresult = (event: any) => {
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
        speechRecognition.current.start();
      }

      setTranscript('');
      interimTranscript.current = '';
      setIsRecording(true);
    } catch (err: any) {
      setError('Microphone access denied: ' + err.message);
    }
  };

  const stopRecording = useCallback(() => {
    if (speechRecognition.current) {
      try { speechRecognition.current.stop(); } catch (e) {}
      speechRecognition.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach((t) => t.stop());
      mediaStream.current = null;
    }

    const finalTranscript = interimTranscript.current.trim();
    setIsRecording(false);
    setVolume(0);

    // Send the transcript as a voice turn to the backend
    if (finalTranscript && socket) {
      setIsProcessing(true);
      socket.emit('voice_turn', {
        transcript: finalTranscript,
        sessionId: currentSessionId.current,
        currentQuestion: currentQuestion.current,
      });
    }
  }, [socket]);

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
