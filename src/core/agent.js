import { chatCompletion } from '../api/client.js';
import { streamChatCompletion } from '../api/stream.js';
import registry from '../tools/registry.js';
import { model } from '../config/index.js';
import { Action } from './state.js';

function mergeToolCalls(map, deltas) {
  for (const delta of deltas) {
    const idx = delta.index;
    if (!map.has(idx)) {
      map.set(idx, {
        id: delta.id || '',
        type: 'function',
        function: {
          name: delta.function?.name || '',
          arguments: delta.function?.arguments || '',
        },
      });
    } else {
      const cur = map.get(idx);
      if (delta.id) cur.id = delta.id;
      if (delta.function?.name) cur.function.name = delta.function.name;
      if (delta.function?.arguments) cur.function.arguments += delta.function.arguments;
    }
  }
}

export async function runAgent({ dispatch, getState }) {
  let iterations = 0;

  while (iterations < model.maxToolIterations) {
    iterations++;

    try {
      const { messages } = getState();
      const tools = registry.definitions();
      const response = await chatCompletion({ messages, tools, stream: true });
      dispatch({ type: Action.START_STREAM });

      const toolCallsByIndex = new Map();
      let finishReason = null;

      for await (const chunk of streamChatCompletion(response)) {
        if (chunk.content) {
          dispatch({ type: Action.APPEND_CONTENT, content: chunk.content });
        }
        if (chunk.tool_calls) {
          mergeToolCalls(toolCallsByIndex, chunk.tool_calls);
        }
        if (chunk.finish_reason) {
          finishReason = chunk.finish_reason;
        }
      }

      if (finishReason === 'stop') {
        dispatch({ type: Action.FINISH_STREAM });
        return;
      }

      if (finishReason === 'tool_calls') {
        const completedToolCalls = Array.from(toolCallsByIndex.values());
        dispatch({ type: Action.SET_TOOL_CALLS, toolCalls: completedToolCalls });

        for (const tc of completedToolCalls) {
          let args = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            // arguments 不是合法 JSON，传入空对象
          }
          const result = await registry.execute(tc.function.name, args);
          dispatch({
            type: Action.ADD_TOOL_RESULT,
            toolCallId: tc.id,
            content: result,
          });
        }
        continue;
      }

      // finishReason 既非 stop 也非 tool_calls（如 length）
      dispatch({ type: Action.FINISH_STREAM });
      return;
    } catch (err) {
      dispatch({ type: Action.SET_ERROR, error: err.message });
      return;
    }
  }

  dispatch({
    type: Action.SET_ERROR,
    error: `Reached max tool iterations (${model.maxToolIterations})`,
  });
}
