import { testEnv } from './test-env';

// Corre antes de importar AppModule: varios módulos leen process.env al cargarse.
// Pisar DATABASE_URL también evita que Prisma tome la de backend/.env.
Object.assign(process.env, testEnv);
