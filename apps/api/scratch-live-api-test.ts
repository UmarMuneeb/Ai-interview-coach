import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import { QuestionsService } from './src/questions/questions.service';
import { AssessmentService } from './src/assessment/assessment.service';
import { SessionsService } from './src/sessions/sessions.service';

async function runLiveTest() {
  console.log('--- Live API LLM Integration Test ---');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const prisma = app.get(PrismaService);
  const questionsService = app.get(QuestionsService);
  const assessmentService = app.get(AssessmentService);
  const sessionsService = app.get(SessionsService);

  try {
    const user = await prisma.user.create({
      data: { email: `live-tester-${Date.now()}@example.com`, password_hash: 'hash' }
    });

    const mockQ = await questionsService.getMockQuestion('JavaScript');
    await prisma.question.create({ data: mockQ });

    const session = await sessionsService.createSession(user.id, 'Frontend', 'technical', 30, 5);
    
    console.log(`\nQuestion: ${mockQ.prompt}`);
    console.log(`Rubric Points: ${mockQ.rubric_points.join(', ')}`);
    
    const candidateAnswer = "I would use a closure by returning an inner function from an outer function, which allows the inner function to access variables from the outer function's scope even after it has returned.";
    console.log(`\nCandidate Answer: "${candidateAnswer}"`);

    console.log('\nCalling AssessmentService -> ProviderRouter -> Live LLM (Gemini/OpenAI)...');
    
    // Live call!
    const result = await sessionsService.submitAnswer(session.id, mockQ, candidateAnswer);
    
    console.log('\n--- LLM Live Classification Result ---');
    console.log(`[Assessment] Classification: ${result.answer.classification}`);
    console.log(`[Assessment] Reasoning: ${result.answer.reasoning}`);

  } catch (err: any) {
    console.error('❌ ERROR DURING EXECUTION:', err.message);
    console.error(err.stack);
  } finally {
    await app.close();
  }
}

runLiveTest();
