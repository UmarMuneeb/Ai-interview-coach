import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SessionsService } from './src/sessions/sessions.service';
import { PrismaService } from './src/prisma/prisma.service';

async function runTest() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const sessionsService = app.get(SessionsService);
  const prismaService = app.get(PrismaService);
  
  try {
    // 1. Create a mock user
    const user = await prismaService.user.create({
      data: {
        email: 'tutor-loop-test@test.com',
        password_hash: 'hash',
      }
    });

    // 2. Create a mock question
    const question = await prismaService.question.create({
      data: {
        source_db: 'mock',
        topic: 'System Design',
        subtopic: 'Load Balancing',
        difficulty: 2,
        prompt: 'Explain what a load balancer is and why it is useful.',
        rubric_points: [
          'Mention that it distributes traffic across multiple servers.',
          'Mention that it improves availability and reliability.',
          'Mention that it prevents single points of failure.'
        ],
        last_refreshed_at: new Date(),
      }
    });

    // 3. Create session & submit an incorrect answer to set up the tutor phase
    const sessionRecord = await sessionsService.createSession(user.id, 'Software Engineering', 'interview', 30, 1);
    
    // Using a really bad answer so it gets classified as incorrect/partial
    const answerResult = await sessionsService.submitAnswer(
      sessionRecord.id,
      question,
      "I think a load balancer is a physical scale."
    );

    console.log(`Initial answer classified as: ${answerResult.answer.classification}`);

    // 4. Transition to tutor phase
    const transitionResult = await sessionsService.transitionToTutorPhase(sessionRecord.id);
    if (!transitionResult.weakAnswer) {
      throw new Error('Expected to find a weak answer');
    }
    console.log('✅ PASS: Transitioned to tutor phase and found weak answer');

    // 5. Submit a tutor answer that resolves it
    const goodAnswer = "A load balancer distributes network traffic across multiple servers to improve reliability, availability, and prevent a single point of failure.";
    const tutorResult = await sessionsService.submitTutorAnswer(sessionRecord.id, question.id, goodAnswer);
    
    if (tutorResult.tutorResult.resolved === true) {
      console.log('✅ PASS: Tutor successfully evaluated the correct answer as resolved');
    } else {
      throw new Error('Tutor failed to resolve the correct answer');
    }

    // Since there are no more weak answers, nextWeakAnswer should be null
    if (tutorResult.nextWeakAnswer === null) {
      console.log('✅ PASS: nextWeakAnswer is null, meaning the tutor phase is over');
    } else {
      throw new Error('nextWeakAnswer was not null, expected the tutor phase to end');
    }

    // Check if session status is completed
    const finalSession = await prismaService.session.findUnique({ where: { id: sessionRecord.id }});
    if (finalSession!.status === 'completed') {
      console.log('✅ PASS: Session status is completed');
    } else {
      throw new Error(`Session status is not completed, it is ${finalSession!.status}`);
    }

    // Cleanup
    await prismaService.tutorAttempt.deleteMany({ where: { session_id: sessionRecord.id } });
    await prismaService.sessionAnswer.deleteMany({ where: { session_id: sessionRecord.id } });
    await prismaService.skillProfile.deleteMany({ where: { user_id: user.id } });
    await prismaService.providerUsage.deleteMany({ where: { session_id: sessionRecord.id } });
    await prismaService.question.delete({ where: { id: question.id } });
    await prismaService.session.delete({ where: { id: sessionRecord.id } });
    await prismaService.user.delete({ where: { id: user.id } });

  } catch (err) {
    console.error('❌ FATAL ERROR DURING EXECUTION:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runTest();
