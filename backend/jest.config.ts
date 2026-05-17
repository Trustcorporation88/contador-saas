import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    // Mapear path aliases do tsconfig
    '^@/(.*)$':             '<rootDir>/src/$1',
    '^@config/(.*)$':       '<rootDir>/src/config/$1',
    '^@middleware/(.*)$':   '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$':       '<rootDir>/src/routes/$1',
    '^@controllers/(.*)$':  '<rootDir>/src/controllers/$1',
    '^@services/(.*)$':     '<rootDir>/src/services/$1',
    '^@models/(.*)$':       '<rootDir>/src/models/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      diagnostics: false,
      tsconfig: {
        strict: false,
        noImplicitAny: false,
        esModuleInterop: true,
      },
    }],
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/controllers/**/*.ts',
    'src/middleware/**/*.ts',
    '!src/**/*.d.ts',
    '!src/config/**',
  ],
  coverageThreshold: {
    global: {
      lines:      80,
      functions:  80,
      branches:   70,
      statements: 80,
    },
  },
  testTimeout: 15000,
  setupFiles: ['<rootDir>/tests/env-setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  verbose: true,
  clearMocks: true,
};

export default config;
