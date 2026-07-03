import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import { QuestionsService } from './src/questions/questions.service';
import { AssessmentService } from './src/assessment/assessment.service';
import { SessionsService } from './src/sessions/sessions.service';
import { ProviderRouterService } from './src/provider-router/provider-router.service';

async function runTests() {
  console.log('--- Phase 2 Integration Tester Starting ---');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const prisma = app.get(PrismaService);
  const questionsService = app.get(QuestionsService);
  const assessmentService = app.get(AssessmentService);
  const sessionsService = app.get(SessionsService);

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

  try {
    // 1. Database & Prisma Service
    const user = await prisma.user.create({
      data: { email: `tester-${Date.now()}@example.com`, password_hash: 'hash' }
    });
    assert(!!user.id, 'PrismaService can insert and retrieve a User (DB connection works)');

    // 2. QuestionsService (Aggregator)
    const mockQ = await questionsService.getMockQuestion('JavaScript');
    assert(mockQ.topic === 'JavaScript', 'QuestionsService correctly aggregates and filters the requested topic');
    assert(mockQ.rubric_points.length > 0, 'QuestionsService mock question has rubric points');

    // Insert mock question into DB to satisfy foreign keys
    await prisma.question.create({ data: mockQ });

    // 3. AssessmentService & ProviderRouterService
    const mockSession = { id: 'test-session-id' };
    try {
      await assessmentService.classifyAnswer(
        "I would use a closure by returning a function from another function.",
        mockQ.rubric_points,
        mockSession.id
      );
      assert(false, 'AssessmentService should have thrown an error due to missing/invalid API keys.');
    } catch (e: any) {
      assert(
        e.message.includes('All LLM providers failed or are degraded.'),
        `ProviderRouter successfully executed the fallback chain and circuit breaker. Caught expected error: ${e.message}`
      );
    }

    // 4. Sessions & Skill Profile
    const session = await sessionsService.createSession(user.id, 'Frontend', 'technical', 30, 5);
    assert(session.status === 'active', 'SessionsService correctly creates an active session');

    // Mock ProviderRouter so the rest of the flow works without API keys
    const providerRouter = app.get(ProviderRouterService);
    providerRouter.complete = async () => ({
      content: { classification: 'correct', confidence: 0.9, reasoning: 'mock', missingPoints: [] }
    });

    const sessionAnswer = await sessionsService.submitAnswer(session.id, mockQ, 'my answer transcript');
    assert(sessionAnswer.classification === 'correct', 'SessionsService links the assessed classification correctly');
    
    // Check Skill Profile side effect
    const profile = await prisma.skillProfile.findUnique({
      where: { user_id_topic_subtopic: { user_id: user.id, topic: mockQ.topic, subtopic: mockQ.subtopic } }
    });
    
    assert(profile !== null, 'SkillProfileService created/updated the SkillProfile side-effect');
    if (profile) {
      assert(profile.mastery_score > 0, 'SkillProfileService correctly incremented the mastery score (since mock is correct)', `Score: ${profile.mastery_score}`);
      assert(profile.correct_count > 0, 'SkillProfileService correctly incremented the correct_count (since mock is correct)', `Count: ${profile.correct_count}`);
    }

  } catch (err: any) {
    console.error('❌ FATAL ERROR DURING EXECUTION:', err.message);
    console.error(err.stack);
    failed++;
  } finally {
    await app.close();
  }

  console.log(`\n--- Test Summary ---`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
