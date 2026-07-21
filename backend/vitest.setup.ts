// Tests must never touch the real dev.db or make real OpenAI calls.
process.env.DATABASE_URL = 'file:./test.db';
delete process.env.OPENAI_API_KEY;
