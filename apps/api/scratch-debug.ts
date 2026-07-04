import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { SessionsService } from './src/sessions/sessions.service';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const svc = app.get(SessionsService);
  console.log("SessionsService keys:", Object.keys(svc));
  console.log("prisma injected:", (svc as any).prisma !== undefined);
  await app.close();
}
test();
