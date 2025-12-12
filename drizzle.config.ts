import type { Config } from 'drizzle-kit'

export default {
   schema: './src/db/schema.ts',
   out: './drizzle',
   dialect: 'postgresql',
   driver: 'pglite',
   dbCredentials: {
      url: process.env.DB_URL!,
   },
} satisfies Config
