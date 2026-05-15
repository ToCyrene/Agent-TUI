import { server } from '../config/index.js';

export async function chatCompletion({ messages, tools, stream = true }) {
  const body = {
    model: server.model,
    messages,
    stream,
  };
  if (tools) body.tools = tools;

  const response = await fetch(`${server.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${server.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  return stream ? response : response.json();
}
