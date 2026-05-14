const config = {
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL || 'https://api.openai.com/v1',
  model: process.env.MODEL_NAME || 'gpt-4o',
};

if (!config.apiKey) {
  throw new Error('API_KEY is required');
}

export default config;
