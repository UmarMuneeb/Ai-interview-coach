import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { JwtService } from '@nestjs/jwt';
import { io } from 'socket.io-client';

async function runVoiceGatewayTest() {
  console.log('--- VoiceGateway Integration Test ---');
  const app = await NestFactory.createApplicationContext(AppModule);
  const jwtService = app.get(JwtService);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, clues: string = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (clues) console.error(`   Clues: ${clues}`);
      failed++;
    }
  }

  // 1. Generate a valid token
  const validToken = await jwtService.signAsync({ sub: 'test-user-id', email: 'test@example.com' });

  // 2. Test Connection Without Token
  const unauthSocket = io('http://localhost:3000', {
    transports: ['websocket'],
    auth: {},
  });

  await new Promise<void>((resolve) => {
    unauthSocket.on('connect', () => {
      // It might connect but immediately disconnect
    });
    unauthSocket.on('disconnect', (reason) => {
      assert(reason === 'io server disconnect', 'Unauthenticated socket is forcibly disconnected by server');
      resolve();
    });
    setTimeout(() => {
      resolve();
    }, 2000);
  });

  // 3. Test Connection With Valid Token
  const authSocket = io('http://localhost:3000', {
    transports: ['websocket'],
    auth: {
      token: validToken,
    },
  });

  await new Promise<void>((resolve) => {
    authSocket.on('connect', () => {
      assert(true, 'Authenticated socket successfully connects');
      
      // Send an audio chunk
      authSocket.emit('audio_chunk', { data: 'fake_binary_data' });
    });

    authSocket.on('audio_ack', (ack) => {
      assert(ack.received === true, 'Server acknowledges audio_chunk event');
      authSocket.disconnect();
      resolve();
    });

    authSocket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        assert(false, 'Authenticated socket should not be disconnected by server');
        resolve();
      }
    });

    setTimeout(() => {
      resolve();
    }, 3000);
  });

  console.log(`\n--- Test Summary ---`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  await app.close();
  if (failed > 0) {
    process.exit(1);
  }
}

runVoiceGatewayTest();
