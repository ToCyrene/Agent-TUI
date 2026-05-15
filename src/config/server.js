const serverConfig = {
  get apiKey() {
    const key = process.env.API_KEY;
    if (!key) throw new Error('API_KEY is required');
    return key;
  },
  baseURL: process.env.BASE_URL || 'https://api.openai.com/v1',
  model: process.env.MODEL_NAME || 'gpt-4o',
};

export default serverConfig;
