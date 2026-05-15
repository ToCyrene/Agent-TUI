import { model } from '../config/index.js';

function estimateTokens(text) {
  if (!text) return 0;
  const cjk = (text.match(/[\p{Script=Han}]/gu) || []).length;
  const other = text.length - cjk;
  return Math.ceil(cjk * model.tokenRatioCJK + other * model.tokenRatioOther);
}

function messageOverhead(msg) {
  let n = model.msgOverheadBase;
  if (msg.role === 'tool') n += model.msgOverheadToolMsg;
  if (msg.tool_calls) n += model.msgOverheadToolCall;
  return n;
}

function messagesTokenCount(messages) {
  let total = model.framingOverhead;
  for (const msg of messages) {
    total += messageOverhead(msg);
    total += estimateTokens(msg.content);
    if (msg.tool_calls) {
      total += estimateTokens(JSON.stringify(msg.tool_calls));
    }
  }
  return total;
}

function trimMessages(messages, maxTokens) {
  let total = messagesTokenCount(messages);
  const removed = new Set();
  for (let i = 0; i < messages.length && total > maxTokens; i++) {
    if (messages[i].role === 'system') continue;
    total -= messageOverhead(messages[i]);
    total -= estimateTokens(messages[i].content);
    if (messages[i].tool_calls) {
      total -= estimateTokens(JSON.stringify(messages[i].tool_calls));
    }
    removed.add(i);
  }
  return messages.filter((_, i) => !removed.has(i));
}

export { estimateTokens, messagesTokenCount, trimMessages };
