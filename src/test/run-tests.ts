#!/usr/bin/env node

/**
 * Test runner script for Arsenal Matchday Pulse
 * This script provides additional test utilities and can be used for CI/CD
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const TEST_COMMANDS = {
  unit: 'vitest run',
  watch: 'vitest',
  coverage: 'vitest run --coverage',
  ui: 'vitest --ui'
};

const TEST_PATTERNS = {
  all: 'src/**/*.{test,spec}.{js,ts}',
  services: 'src/lib/services/**/*.{test,spec}.{js,ts}',
  routes: 'src/routes/**/*.{test,spec}.{js,ts}',
  config: 'src/lib/config/**/*.{test,spec}.{js,ts}'
};

function runCommand(command: string, description: string) {
  console.log(`\n🧪 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed successfully`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error);
    process.exit(1);
  }
}

function checkTestFiles() {
  console.log('🔍 Checking for test files...');
  
  const testFiles = [
    'src/lib/services/bskyService.test.ts',
    'src/lib/config/bsky.test.ts',
    'src/routes/live/bsky/stream.sse/server.test.ts',
    'src/routes/accounts/[platform]/page.test.ts',
    'src/routes/api/accounts/bsky/server.test.ts',
    'src/routes/page.test.ts',
    'src/routes/match/[id]/page.test.ts'
  ];

  const missingFiles = testFiles.filter(file => !existsSync(file));
  
  if (missingFiles.length > 0) {
    console.warn('⚠️  Missing test files:', missingFiles);
  } else {
    console.log('✅ All expected test files found');
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'unit';
  const pattern = args[1] || 'all';

  console.log('🚀 Arsenal Matchday Pulse Test Runner');
  console.log('=====================================');

  checkTestFiles();

  switch (command) {
    case 'unit': {
      const pat = TEST_PATTERNS[pattern] ?? pattern;
      runCommand(`${TEST_COMMANDS.unit} "${pat}"`, 'Running unit tests');
      break;
    }
    case 'watch':
      runCommand(TEST_COMMANDS.watch, 'Running tests in watch mode');
      break;
    case 'coverage': {
      const pat = TEST_PATTERNS[pattern] ?? pattern;
      runCommand(`${TEST_COMMANDS.coverage} "${pat}"`, 'Running tests with coverage');
      break;
    }
    case 'ui':
      runCommand(TEST_COMMANDS.ui, 'Opening test UI');
      break;
    case 'all': {
      const pat = TEST_PATTERNS[pattern] ?? pattern;
      runCommand(`${TEST_COMMANDS.unit} "${pat}" --reporter=verbose`, 'Running all tests with verbose output');
      break;
    }
    default:
      console.log('Available commands:');
      console.log('  unit     - Run unit tests once');
      console.log('  watch    - Run tests in watch mode');
      console.log('  coverage - Run tests with coverage report');
      console.log('  ui       - Open test UI');
      console.log('  all      - Run all tests with verbose output');
      console.log('\nUsage: npm run test:run [command] [pattern]');
      break;
  }
}

main();

export { runCommand, checkTestFiles, TEST_COMMANDS, TEST_PATTERNS };
