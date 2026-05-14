export async function* streamChatCompletion(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      const data = line.slice(6);
      if (data === '[DONE]') return;

      const chunk = JSON.parse(data);
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      yield {
        content: choice.delta?.content ?? null,
        tool_calls: choice.delta?.tool_calls ?? null,
        finish_reason: choice.finish_reason ?? null,
      };
    }
  }
}
