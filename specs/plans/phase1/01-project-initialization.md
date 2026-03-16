# Chunk 1: Project Initialization (Tasks 1–5)

**Depends on:** Nothing — this is the first chunk.
**Delivers:** A working Node.js project with TypeScript, ESLint, Prettier, Vitest, Docker Compose, and environment scaffolding.

---

### Task 1: Create package.json

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "express-api-starter",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:unit": "vitest run --config vitest.config.unit.ts",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "test:coverage": "vitest run --coverage",
    "postinstall": "prisma generate"
  },
  "prisma": {
    "schema": "prisma/schema"
  },
  "dependencies": {
    "@opentelemetry/auto-instrumentations-node": "^0.56.0",
    "@opentelemetry/sdk-node": "^0.57.0",
    "@opentelemetry/sdk-trace-base": "^1.30.0",
    "@prisma/client": "^6.4.0",
    "awilix": "^12.0.0",
    "bullmq": "^5.34.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "helmet": "^8.0.0",
    "ioredis": "^5.4.0",
    "pino": "^9.6.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.21.0",
    "@types/node": "^22.0.0",
    "@testcontainers/postgresql": "^10.21.0",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.21.0",
    "pino-pretty": "^13.0.0",
    "prettier": "^3.5.0",
    "prisma": "^6.4.0",
    "supertest": "^7.0.0",
    "testcontainers": "^10.21.0",
    "tsup": "^8.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.24.0",
    "vite-tsconfig-paths": "^5.1.0",
    "vitest": "^3.0.0"
  }
}
```

> **Note:** Version ranges are approximate. Use `npm install` to resolve to latest compatible versions. The `postinstall` script runs `prisma generate` after install — this requires the Prisma schema to exist first (Task 12 creates it). For the initial install, the postinstall may warn about a missing schema — this is expected and harmless.

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: Clean install with no errors (postinstall prisma warning is OK until schema exists)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: initialize package.json with all Phase 1 dependencies"
```

---

### Task 2: TypeScript & Build Config

**Files:**
- Create: `tsconfig.json`
- Create: `tsup.config.ts`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  outDir: 'dist',
  target: 'node22',
  splitting: false,
  sourcemap: true,
});
```

- [ ] **Step 3: Create minimal placeholder to verify typecheck**

Create `src/server.ts`:

```typescript
console.log('server placeholder');
```

- [ ] **Step 4: Verify typecheck works**

Run: `npx tsc --noEmit`
Expected: Clean exit, no errors

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json tsup.config.ts src/server.ts
git commit -m "chore: add TypeScript and tsup build config"
```

---

### Task 3: ESLint & Prettier Config

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`

- [ ] **Step 1: Create .prettierrc**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 2: Create eslint.config.js**

> **Note:** The spec lists `eslint-plugin-boundaries` as an option. This plan uses the built-in `no-restricted-imports` instead — simpler, no extra dependency, same enforcement.

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Domain files: no Express, no Prisma, no infra packages
  {
    files: ['src/features/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'express/*'],
              message: 'Domain layer must not import Express.',
            },
            {
              group: ['@prisma/client', '@prisma/client/*'],
              message: 'Domain layer must not import Prisma directly.',
            },
            {
              group: ['ioredis', 'bullmq', 'pino'],
              message: 'Domain layer must not import infrastructure packages.',
            },
          ],
        },
      ],
    },
  },
  // API files: no Prisma (controllers go through domain, never infra)
  {
    files: ['src/features/*/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '@prisma/client/*'],
              message: 'API layer must not import Prisma directly.',
            },
          ],
        },
      ],
    },
  },
  // Shared files: pure TypeScript only — no Express, no Prisma, no infra packages
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'express/*'],
              message: 'Shared layer must not import Express.',
            },
            {
              group: ['@prisma/client', '@prisma/client/*'],
              message: 'Shared layer must not import Prisma.',
            },
            {
              group: ['ioredis', 'bullmq', 'pino'],
              message: 'Shared layer must not import infrastructure packages.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
);
```

- [ ] **Step 3: Verify lint runs**

Run: `npx eslint .`
Expected: Clean exit (only the placeholder server.ts to check)

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js .prettierrc
git commit -m "chore: add ESLint flat config and Prettier"
```

---

### Task 4: Vitest Unit Test Config

**Files:**
- Create: `vitest.config.unit.ts`

- [ ] **Step 1: Create vitest.config.unit.ts**

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 2: Create a smoke test to verify the runner works**

Create `src/__tests__/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke test', () => {
  it('vitest runs correctly', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: 1 test passes

- [ ] **Step 4: Delete the smoke test**

Delete `src/__tests__/smoke.test.ts` (it served its purpose).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.unit.ts
git commit -m "chore: add Vitest unit test config"
```

---

### Task 5: Docker Compose, .env.example, .gitignore

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:17
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U user']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 2: Create .env.example**

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key-min-32-chars-long!!
JWT_EXPIRES_IN=15m
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
.turbo/
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "chore: add Docker Compose, env example, and gitignore"
```
