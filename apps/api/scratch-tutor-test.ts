import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { TutorService } from './src/tutor/tutor.service';
import { PrismaService } from './src/prisma/prisma.service';

async function runTest() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const tutorService = app.get(TutorService);
  const prismaService = app.get(PrismaService);
  
  try {
    // 1. Create a mock user
    const user = await prismaService.user.create({
      data: {
        email: 'tutor-test-user@test.com',
        password_hash: 'hash',
      }
    });

    // 2. Create a mock session
    const session = await prismaService.session.create({
      data: {
        user_id: user.id,
        field: 'Software Engineering',
        phase: 'tutor',
        status: 'active',
        target_duration_minutes: 30,
        questions_planned: 5,
      }
    });

    // 3. Create a mock question
    const question = await prismaService.question.create({
      data: {
        source_db: 'mock',
        topic: 'React',
        subtopic: 'Hooks',
        difficulty: 1,
        prompt: 'What is useEffect?',
        rubric_points: ['Point 1'],
        last_refreshed_at: new Date(),
      }
    });

    // 4. Test TutorService createAttempt
    const attempt = await tutorService.createAttempt(
      session.id,
      question.id,
      1,
      0,
      'I dont know',
      ['Point 1'],
      false
    );
    console.log('✅ PASS: createAttempt created record with ID:', attempt.id);

    // 5. Test getAttempts
    const attempts = await tutorService.getAttempts(session.id, question.id);
    if (attempts.length === 1 && attempts[0].id === attempt.id) {
      console.log('✅ PASS: getAttempts correctly retrieved the attempt');
    } else {
      throw new Error('getAttempts failed to retrieve the attempt');
    }

    // Cleanup
    await prismaService.tutorAttempt.deleteMany({ where: { session_id: session.id } });
    await prismaService.question.delete({ where: { id: question.id } });
    await prismaService.session.delete({ where: { id: session.id } });
    await prismaService.user.delete({ where: { id: user.id } });

  } catch (err) {
    console.error('❌ FATAL ERROR DURING EXECUTION:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runTest();
