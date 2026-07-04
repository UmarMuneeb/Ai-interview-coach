import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SessionsService } from './src/sessions/sessions.service';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const svc = app.get(SessionsService);
  console.log("prisma:", !!(svc as any).prisma);
  console.log("skill:", !!(svc as any).skillProfileService);
  console.log("assessment:", !!(svc as any).assessmentService);
  console.log("questions:", !!(svc as any).questionsService);
  console.log("tutor:", !!(svc as any).tutorService);
  await app.close();
}
test();
