// Setup file for all tests
// Add any global setup here

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  process.env.DATABASE_URL = 'postgresql://auraos_user:auraos_password@localhost:5432/auraos_test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.JWT_EXPIRES_IN = '7d';

  // Suppress console.error during tests to keep logs clean
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  // Cleanup if needed

  // Restore console.error after tests are done
  (console.error as jest.Mock).mockRestore();
});

describe('Global Setup', () => {
  it('should initialize the test environment', () => {
    expect(true).toBe(true);
  });
});
