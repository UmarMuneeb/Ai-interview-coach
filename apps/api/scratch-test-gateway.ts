import { io } from 'socket.io-client';
import * as jwt from 'jsonwebtoken';

// Create a fake token
const token = jwt.sign({ sub: '76c5f0a6-2afe-499b-8222-e07077579274' }, process.env.JWT_SECRET || 'fallback_secret');

const socket = io('http://localhost:3001', {
  auth: { token },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected to Gateway');
  socket.emit('start_voice_session', { sessionId: 'test-session', initialPrompt: 'I am ready. Please ask the question.' });
});

socket.on('voice_session_started', () => {
  console.log('Voice session started!');
});

socket.on('audio_response', (data) => {
  console.log('Got audio, size:', data.delta.length);
});

socket.on('text_transcript', (data) => {
  console.log('Got text:', data.text);
});

socket.on('voice_error', (err) => {
  console.error('Voice error:', err);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});

setTimeout(() => {
  console.log('Closing test script');
  process.exit(0);
}, 6000);
