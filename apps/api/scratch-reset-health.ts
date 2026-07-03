import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.providerHealth.updateMany({
    data: {
      status: 'healthy',
      consecutive_failures: 0,
      cooldown_until: null,
      last_error: null,
    },
  });
  console.log('✅ ProviderHealth successfully reset. Circuit breaker is closed.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
