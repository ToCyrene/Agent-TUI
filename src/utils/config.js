const config = {
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.OPENAI_MODEL || 'gpt-4o',
};

if (!config.apiKey) {
  throw new Error('OPENAI_API_KEY is required');
}

export default config;
