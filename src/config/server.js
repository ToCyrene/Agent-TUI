const serverConfig = {
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL || 'https://api.openai.com/v1',
  model: process.env.MODEL_NAME || 'gpt-4o',
};

if (!serverConfig.apiKey) {
  throw new Error('API_KEY is required');
}

export default serverConfig;
