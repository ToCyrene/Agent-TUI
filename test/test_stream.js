import { chatCompletion } from '../src/api/client.js';
import { streamChatCompletion } from '../src/api/stream.js';

const response = await chatCompletion({
  messages: [{ role: 'user', content: '生成一段描写夕阳的段落，50字左右' }],
  stream: true,
});

console.log('→ 连接成功，开始接收流式响应:\n');

let fullContent = '';
for await (const chunk of streamChatCompletion(response)) {
  if (chunk.content) {
    fullContent += chunk.content;
    process.stdout.write(chunk.content);
  }
  if (chunk.tool_calls) {
    console.log('\n[工具调用]', JSON.stringify(chunk.tool_calls, null, 2));
  }
  if (chunk.finish_reason) {
    console.log(`\n\n[完成] finish_reason: ${chunk.finish_reason}`);
  }
}
