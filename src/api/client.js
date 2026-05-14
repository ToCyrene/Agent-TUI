import config from '../utils/config.js';

export async function chatCompletion({ messages, tools, stream = true }) {
  const body = {
    model: config.model,
    messages,
    stream,
  };
  if (tools) body.tools = tools;

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  return stream ? response : response.json();
}
