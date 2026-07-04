import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useVoiceInterviewer(sessionId: string, initialPrompt?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const audioContext = useRef<AudioContext | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const workletNode = useRef<AudioWorkletNode | null>(null);
  const speechRecognition = useRef<any>(null);
  const playbackQueue = useRef<Float32Array[]>([]);
  const isPlayingAudio = useRef(false);
  const nextPlayTime = useRef(0);
  const interimTranscript = useRef('');

  // Initialize Socket.io
  useEffect(() => {
    if (!sessionId) return;
    
    const token = localStorage.getItem('ai_coach_token');
    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to VoiceGateway');
    });

    newSocket.on('voice_error', (data) => {
      setError(data.message);
    });
    
    newSocket.on('voice_session_started', () => {
      setIsVoiceMode(true);
      setIsProcessing(true); // Will be set to false when first audio arrives
    });

    newSocket.on('audio_response', async (data) => {
      setIsProcessing(false);
      // Decode base64 to PCM (assumes 24kHz 16-bit PCM from Gemini)
      if (!audioContext.current) return;
      
      const base64 = data.delta;
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = (int16Array[i] as number) / 32768.0;
      }
      
      playbackQueue.current.push(float32Array);
      playNextChunk();
    });

    newSocket.on('text_transcript', (data) => {
      setIsProcessing(false);
      setTranscript(prev => prev + data.text);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId]);

  const playNextChunk = async () => {
    if (isPlayingAudio.current || playbackQueue.current.length === 0 || !audioContext.current) {
      return;
    }

    setIsPlaying(true);
    isPlayingAudio.current = true;
    
    const chunk = playbackQueue.current.shift()!;
    const audioBuffer = audioContext.current.createBuffer(1, chunk.length, 24000);
    audioBuffer.copyToChannel(chunk as any, 0);

    const source = audioContext.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.current.destination);

    source.onended = () => {
      isPlayingAudio.current = false;
      if (playbackQueue.current.length === 0) {
        setIsPlaying(false);
      } else {
        playNextChunk();
      }
    };

    const currentTime = audioContext.current.currentTime;
    if (nextPlayTime.current < currentTime) {
        nextPlayTime.current = currentTime;
    }
    source.start(nextPlayTime.current);
    nextPlayTime.current += audioBuffer.duration;
  };

  const startVoiceSession = useCallback(async () => {
    setError(null);
    if (!socket) return;
    
    // Resume or create AudioContext for playback (Safari requires this inside user gesture)
    if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume();
    }

    socket.emit('start_voice_session', { sessionId, initialPrompt });
  }, [socket, sessionId, initialPrompt]);

  const updatePrompt = useCallback((prompt: string) => {
    if (!socket) return;
    socket.emit('update_voice_prompt', { prompt });
  }, [socket]);

  const startRecording = async () => {
    try {
      mediaStream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const source = audioContext.current!.createMediaStreamSource(mediaStream.current);
      
      // A simple script processor for PCM extraction (1024 buffer size for ~15fps smooth visualizer updates)
      const processor = audioContext.current!.createScriptProcessor(1024, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate RMS volume for visualizer
        let sumSquares = 0;
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const val = inputData[i] as number;
          sumSquares += val * val;
          pcmData[i] = Math.max(-32768, Math.min(32767, Math.floor(val * 32768)));
        }
        
        const rms = Math.sqrt(sumSquares / inputData.length);
        // Map rms to a much more sensitive scale for the UI graph lift (e.g. 0 to 1)
        setVolume(Math.min(1, rms * 10));

        // Base64 encode
        const uint8Array = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i] as number);
        }
        const base64Audio = window.btoa(binary);
        
        socket?.emit('audio_chunk', { audio: base64Audio });
      };

      source.connect(processor);
      processor.connect(audioContext.current!.destination);
      workletNode.current = processor as any;
      
      // Initialize Speech Recognition for User Transcript
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        speechRecognition.current = new SpeechRecognition();
        speechRecognition.current.continuous = true;
        speechRecognition.current.interimResults = true;
        speechRecognition.current.onresult = (event: any) => {
          let final = '';
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          interimTranscript.current += final;
          setTranscript(interimTranscript.current + ' ' + interim);
        };
        speechRecognition.current.start();
      }

      setTranscript(''); // Clear on start
      interimTranscript.current = '';
      setIsRecording(true);
    } catch (err: any) {
      setError('Microphone access denied or error: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (speechRecognition.current) {
      try { speechRecognition.current.stop(); } catch(e) {}
      speechRecognition.current = null;
    }
    if (workletNode.current) {
      workletNode.current.disconnect();
      workletNode.current = null;
    }
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
      mediaStream.current = null;
    }
    socket?.emit('commit_audio');
    setIsRecording(false);
    setIsProcessing(true);
    setVolume(0);
  };

  return {
    isVoiceMode,
    startVoiceSession,
    updatePrompt,
    startRecording,
    stopRecording,
    isRecording,
    isPlaying,
    transcript,
    error,
    volume,
    isProcessing,
    setTranscript // allow manual override
  };
}
