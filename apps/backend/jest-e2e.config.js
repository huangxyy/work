module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: './e2e',
  testRegex: '.\\.e2e-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.e2e-spec.ts'],
  coverageDirectory: '../coverage-e2e',
  testEnvironment: 'node',
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/../src/$1' },
  // E2E tests run slower, increase timeout
  testTimeout: 30000,
};
