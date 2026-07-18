// Tests must never touch the real dev.db or make real Anthropic calls.
process.env.DATABASE_URL = 'file:./test.db';
delete process.env.ANTHROPIC_API_KEY;
