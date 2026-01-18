/**
 * E2E Test Setup
 * Runs before all tests to ensure backend is available
 */

import { beforeAll, afterAll } from 'vitest';
import { API_BASE, healthCheck } from './helpers/api';

beforeAll(async () => {
  console.log(`\n🔌 Connecting to backend at ${API_BASE}...`);

  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const healthy = await healthCheck();
      if (healthy) {
        console.log('✅ Backend is healthy\n');
        return;
      }
    } catch (error) {
      retries++;
      if (retries < maxRetries) {
        console.log(`⏳ Backend not ready, retrying (${retries}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error('❌ Backend is not available. Please start the backend server first.');
  console.error('   Run: cd backend && cargo run');
  process.exit(1);
});

afterAll(() => {
  console.log('\n🏁 E2E tests completed\n');
});
