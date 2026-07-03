import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SessionsService } from './src/sessions/sessions.service';
import { PrismaService } from './src/prisma/prisma.service';
import { TutorService } from './src/tutor/tutor.service';

async function runTests() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const sessionsService = app.get(SessionsService);
  const prismaService = app.get(PrismaService);
  const tutorService = app.get(TutorService);
  
  let passed = 0;
  let failed = 0;

  // Reset circuit breaker so fresh API keys can be tested without waiting for cooldown
  await prismaService.providerHealth.updateMany({
    data: {
      status: 'healthy',
      consecutive_failures: 0,
      cooldown_until: null,
      last_error: null,
    },
  });
  console.log('✅ Circuit breaker reset.');

  try {
    console.log('--- Phase 5 Integration Tester Starting ---');

    // 1. Create a mock user
    const user = await prismaService.user.create({
      data: { email: `test-${Date.now()}@test.com`, password_hash: 'hash' }
    });

    // 2. Create mock questions
    const question1 = await prismaService.question.create({
      data: {
        source_db: 'mock', topic: 'System Design', subtopic: 'Load Balancing', difficulty: 2,
        prompt: 'Explain what a load balancer is and why it is useful.',
        rubric_points: [
          'Mention that it distributes traffic across multiple servers.',
          'Mention that it improves availability and reliability.',
          'Mention that it prevents single points of failure.'
        ],
        last_refreshed_at: new Date(),
      }
    });

    const sessionRecord = await sessionsService.createSession(user.id, 'Software Engineering', 'interview', 30, 2);

    // Initial Answers (both terrible to queue them up as weak answers)
    await sessionsService.submitAnswer(sessionRecord.id, question1, "A load balancer is a weight.");

    console.log('✅ PASS: Submitted initial bad answers to populate weak queue.');
    passed++;

    // Transition to Tutor phase
    const transitionResult = await sessionsService.transitionToTutorPhase(sessionRecord.id);
    if (!transitionResult.weakAnswer || transitionResult.weakAnswer.question_id !== question1.id) {
      throw new Error('Expected to find question1 as weak answer');
    }
    console.log('✅ PASS: Transitioned to tutor phase and found weak answer.');
    passed++;

    // Test Case 1: Incorrect Tutor Answer (Generates Hint)
    const badTutorResult = await sessionsService.submitTutorAnswer(sessionRecord.id, question1.id, "I still think it's a weight scale.");
    if (badTutorResult.tutorResult.resolved === false && badTutorResult.tutorResult.hint) {
      console.log('✅ PASS: Tutor correctly marked bad answer unresolved and generated a hint.');
      passed++;
    } else {
      throw new Error(`Expected unresolved with hint, got resolved=${badTutorResult.tutorResult.resolved}`);
    }

    // Test Case 2: Max Attempts Cap (Failing 2 more times should exhaust attempts)
    await sessionsService.submitTutorAnswer(sessionRecord.id, question1.id, "Maybe a bridge?");
    const maxAttemptResult = await sessionsService.submitTutorAnswer(sessionRecord.id, question1.id, "I give up.");
    
    // On the 3rd attempt, it should force resolve/move on.
    if (maxAttemptResult.tutorResult.resolved === false && maxAttemptResult.nextWeakAnswer === null) {
      console.log('✅ PASS: Tutor enforced 3-attempt cap and exhausted the question loop.');
      passed++;
    } else {
      throw new Error(`Expected max attempt forced progression, got resolved=${maxAttemptResult.tutorResult.resolved}, nextWeakAnswer=${maxAttemptResult.nextWeakAnswer}`);
    }

    // Session completion check
    const finalSession = await prismaService.session.findUnique({ where: { id: sessionRecord.id }});
    if (finalSession!.status === 'completed') {
      console.log('✅ PASS: Session automatically completed after exhausting tutor queue.');
      passed++;
    } else {
      throw new Error(`Session status is not completed, it is ${finalSession!.status}`);
    }

    // Cleanup
    await prismaService.tutorAttempt.deleteMany({ where: { session_id: sessionRecord.id } });
    await prismaService.sessionAnswer.deleteMany({ where: { session_id: sessionRecord.id } });
    await prismaService.skillProfile.deleteMany({ where: { user_id: user.id } });
    await prismaService.providerUsage.deleteMany({ where: { session_id: sessionRecord.id } });
    await prismaService.question.delete({ where: { id: question1.id } });
    await prismaService.session.delete({ where: { id: sessionRecord.id } });
    await prismaService.user.delete({ where: { id: user.id } });

  } catch (err) {
    console.error('❌ FATAL ERROR DURING EXECUTION:', err);
    failed++;
  } finally {
    console.log(`\n--- Test Summary ---`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    await app.close();
  }
}

runTests();
