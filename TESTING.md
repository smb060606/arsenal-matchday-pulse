# Testing Guide for Arsenal Matchday Pulse

This document provides comprehensive information about the testing setup and how to run tests for the Arsenal Matchday Pulse project.

## 🧪 Testing Framework

The project uses **Vitest** as the primary testing framework, which provides:
- Fast test execution
- Built-in TypeScript support
- Jest-compatible API
- Coverage reporting
- Watch mode
- UI interface

## 📁 Test Structure

```
src/
├── test/
│   ├── setup.ts              # Test configuration and mocks
│   ├── utils.ts              # Test utilities and helpers
│   └── run-tests.ts          # Custom test runner script
├── lib/
│   ├── services/
│   │   └── bskyService.test.ts
│   └── config/
│       └── bsky.test.ts
└── routes/
    ├── +page.test.ts
    ├── match/[id]/
    │   └── +page.test.ts
    ├── accounts/[platform]/
    │   └── +page.test.ts
    ├── api/accounts/bsky/
    │   └── +server.test.ts
    └── live/bsky/stream.sse/
        └── +server.test.ts
```

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Open test UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run
```

### Advanced Usage

```bash
# Run specific test files
npx vitest src/lib/services/bskyService.test.ts

# Run tests matching a pattern
npx vitest --run src/routes/**/*.test.ts

# Run tests with specific reporter
npx vitest --reporter=verbose

# Run tests in parallel
npx vitest --threads
```

## 📊 Test Coverage

The project includes comprehensive test coverage for:

### Core Services (`src/lib/services/`)
- **bskyService.test.ts**: Tests for Bluesky API integration
  - Profile resolution and validation
  - Account eligibility checking
  - Post fetching and sentiment analysis
  - Topic extraction and sampling
  - Tick summary generation

### Configuration (`src/lib/config/`)
- **bsky.test.ts**: Tests for configuration validation
  - API endpoint configuration
  - Eligibility thresholds
  - Keywords and allowlist validation
  - Time window settings

### API Endpoints (`src/routes/api/`)
- **+server.test.ts**: Tests for API endpoints
  - JSON response formatting
  - Error handling
  - Data structure validation

### Page Components (`src/routes/`)
- **+page.test.ts**: Tests for page components
  - Navigation structure
  - Content validation
  - Accessibility features
  - UI state management

### Server-Sent Events (`src/routes/live/`)
- **+server.test.ts**: Tests for SSE endpoints
  - Stream initialization
  - Header configuration
  - Error handling
  - Parameter parsing

## 🔧 Test Configuration

### Vitest Configuration (`vitest.config.ts`)

```typescript
export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts']
    }
  }
});
```

### Test Setup (`src/test/setup.ts`)

The setup file configures:
- Mock implementations for external dependencies
- Global test utilities
- Console output suppression
- Mock data factories

## 🛠️ Test Utilities

### Mock Data Factories (`src/test/utils.ts`)

```typescript
// Create mock profiles
const profile = createMockProfile({
  did: 'did:plc:test',
  handle: 'test.bsky.social',
  followersCount: 1000
});

// Create mock posts
const post = createMockPost({
  text: 'Great Arsenal performance!',
  author: { handle: 'test.bsky.social' }
});

// Create mock responses
const feedResponse = createMockFeedResponse([post]);
```

### Validation Helpers

```typescript
// Validate date strings
expectValidISODate('2024-01-01T00:00:00Z');

// Validate DIDs
expectValidDID('did:plc:test123');

// Validate Bluesky handles
expectValidBlueskyHandle('test.bsky.social');
```

## 📋 Test Categories

### Unit Tests
- Individual function testing
- Mock external dependencies
- Isolated component testing
- Pure function validation

### Integration Tests
- API endpoint testing
- Service integration
- Data flow validation
- Error propagation

### Component Tests
- UI component behavior
- State management
- Event handling
- User interaction

## 🎯 Testing Best Practices

### 1. Test Structure
```typescript
describe('ComponentName', () => {
  describe('Feature', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### 2. Mock External Dependencies
```typescript
// Mock external APIs
vi.mock('@atproto/api', () => ({
  BskyAgent: vi.fn().mockImplementation(() => ({
    getProfiles: vi.fn(),
    getProfile: vi.fn()
  }))
}));
```

### 3. Test Data Management
```typescript
// Use factories for consistent test data
const mockAccount = createMockProfile({
  followersCount: 1000,
  eligibility: { eligible: true, reasons: [] }
});
```

### 4. Error Testing
```typescript
it('should handle errors gracefully', async () => {
  mockService.mockRejectedValue(new Error('Service unavailable'));
  
  await expect(asyncFunction()).rejects.toThrow('Service unavailable');
});
```

## 🔍 Debugging Tests

### Running Specific Tests
```bash
# Run tests matching a pattern
npx vitest --run -t "should handle errors"

# Run tests in a specific file
npx vitest src/lib/services/bskyService.test.ts

# Run tests with debug output
npx vitest --reporter=verbose
```

### Test UI
```bash
# Open interactive test UI
npm run test:ui
```

### Coverage Analysis
```bash
# Generate coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/index.html
```

## 🚨 Common Issues

### 1. Mock Not Working
- Ensure mocks are defined before imports
- Check mock implementation matches expected interface
- Verify mock is called with correct parameters

### 2. Async Test Failures
- Use `await` for async operations
- Check promise resolution/rejection
- Verify timeout settings

### 3. Environment Issues
- Ensure `jsdom` environment is configured
- Check global mocks are properly set up
- Verify test setup file is loaded

## 📈 Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:coverage
```

## 🎉 Test Results

When all tests pass, you should see:
- ✅ All test suites passing
- 📊 Coverage report generated
- 🚀 Ready for deployment

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest API Reference](https://jestjs.io/docs/api)
- [Svelte Testing Guide](https://svelte.dev/docs/testing)

---

**Happy Testing! 🧪✨**

