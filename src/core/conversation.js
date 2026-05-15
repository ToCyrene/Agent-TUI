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
  const result = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'system') {
      result.push(msg);
      continue;
    }
    if (total <= maxTokens) {
      result.push(msg);
    } else {
      total -= messageOverhead(msg);
      total -= estimateTokens(msg.content);
      if (msg.tool_calls) {
        total -= estimateTokens(JSON.stringify(msg.tool_calls));
      }
    }
  }
  return result;
}

export { estimateTokens, messagesTokenCount, trimMessages };
