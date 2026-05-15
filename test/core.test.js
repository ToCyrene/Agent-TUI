import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initialState, reducer, Action } from '../src/core/state.js';

// ══════════════════════════════════════════════
// state reducer
// ══════════════════════════════════════════════
describe('state reducer', () => {
  it('initial state', () => {
    expect(initialState).toEqual({ messages: [], streaming: false, error: null, connected: false });
  });

  it('ADD_USER_MESSAGE', () => {
    const s = reducer(initialState, { type: Action.ADD_USER_MESSAGE, content: 'hello' });
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0]).toEqual({ role: 'user', content: 'hello' });
  });

  it('START_STREAM appends empty assistant and sets streaming', () => {
    const s0 = reducer(initialState, { type: Action.ADD_USER_MESSAGE, content: 'hi' });
    const s1 = reducer(s0, { type: Action.START_STREAM });
    expect(s1.streaming).toBe(true);
    expect(s1.messages[1]).toEqual({ role: 'assistant', content: '' });
  });

  it('START_STREAM is idempotent when already streaming', () => {
    const s0 = reducer(initialState, { type: Action.ADD_USER_MESSAGE, content: 'hi' });
    const s1 = reducer(s0, { type: Action.START_STREAM });
    const s2 = reducer(s1, { type: Action.START_STREAM });
    expect(s2.messages).toHaveLength(2);
  });

  it('APPEND_CONTENT adds to last assistant', () => {
    let s = reducer(initialState, { type: Action.ADD_USER_MESSAGE, content: 'hi' });
    s = reducer(s, { type: Action.START_STREAM });
    s = reducer(s, { type: Action.APPEND_CONTENT, content: 'Hello' });
    s = reducer(s, { type: Action.APPEND_CONTENT, content: ' world' });
    expect(s.messages[1].content).toBe('Hello world');
  });

  it('APPEND_CONTENT ignored when not streaming', () => {
    const s = reducer(initialState, { type: Action.APPEND_CONTENT, content: 'x' });
    expect(s.messages).toHaveLength(0);
  });

  it('SET_TOOL_CALLS on last assistant', () => {
    let s = reducer(initialState, { type: Action.ADD_USER_MESSAGE, content: 'run cmd' });
    s = reducer(s, { type: Action.START_STREAM });
    s = reducer(s, { type: Action.SET_TOOL_CALLS, toolCalls: [{ id: '1', function: { name: 'echo' } }] });
    expect(s.messages[1].tool_calls).toHaveLength(1);
  });

  it('FINISH_STREAM clears streaming', () => {
    let s = reducer(initialState, { type: Action.ADD_USER_MESSAGE, content: 'hi' });
    s = reducer(s, { type: Action.START_STREAM });
    s = reducer(s, { type: Action.FINISH_STREAM });
    expect(s.streaming).toBe(false);
  });

  it('ADD_TOOL_RESULT appends tool message', () => {
    const s = reducer(initialState, {
      type: Action.ADD_TOOL_RESULT,
      toolCallId: 'call_1',
      content: 'result',
    });
    expect(s.messages[0]).toEqual({ role: 'tool', content: 'result', tool_call_id: 'call_1' });
  });

  it('SET_ERROR sets error and stops streaming', () => {
    let s = reducer(initialState, { type: Action.ADD_USER_MESSAGE, content: 'hi' });
    s = reducer(s, { type: Action.START_STREAM });
    s = reducer(s, { type: Action.SET_ERROR, error: 'boom' });
    expect(s.error).toBe('boom');
    expect(s.streaming).toBe(false);
  });

  it('CLEAR_ERROR clears error', () => {
    const s0 = reducer(initialState, { type: Action.SET_ERROR, error: 'boom' });
    const s1 = reducer(s0, { type: Action.CLEAR_ERROR });
    expect(s1.error).toBeNull();
  });

  it('unknown action returns state unchanged', () => {
    const s = reducer(initialState, { type: 'NOPE' });
    expect(s).toEqual(initialState);
  });
});

// ══════════════════════════════════════════════
// conversation
// ══════════════════════════════════════════════
import { estimateTokens, messagesTokenCount, trimMessages } from '../src/core/conversation.js';

describe('estimateTokens', () => {
  it('returns 0 for empty/null', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens(null)).toBe(0);
  });

  it('english chars ≈ 0.3 each', () => {
    expect(estimateTokens('hello')).toBe(2);  // 5 × 0.3 = 1.5 → 2
  });

  it('chinese chars ≈ 0.6 each', () => {
    expect(estimateTokens('你好')).toBe(2);   // 2 × 0.6 = 1.2 → 2
    expect(estimateTokens('你好世界')).toBe(3); // 4 × 0.6 = 2.4 → 3
  });

  it('mixed text', () => {
    const t = estimateTokens('hello你好');
    // 5 eng + 2 cjk: 5×0.3 + 2×0.6 = 1.5+1.2 = 2.7 → 3
    expect(t).toBe(3);
  });
});

describe('messagesTokenCount', () => {
  it('includes framing + per-message overhead', () => {
    const count = messagesTokenCount([{ role: 'user', content: 'hi' }]);
    // framing(3) + overhead(4) + 2×0.3=1 = 8
    expect(count).toBe(8);
  });

  it('tool message has extra overhead', () => {
    const normal = messagesTokenCount([{ role: 'user', content: 'x' }]);
    const tool = messagesTokenCount([{ role: 'tool', content: 'x', tool_call_id: '1' }]);
    expect(tool).toBeGreaterThan(normal);
  });

  it('counts tool_calls JSON', () => {
    const without = messagesTokenCount([{ role: 'assistant', content: 'ok' }]);
    const withTc = messagesTokenCount([
      { role: 'assistant', content: 'ok', tool_calls: [{ id: '1', function: { name: 'echo', arguments: '{}' } }] },
    ]);
    expect(withTc).toBeGreaterThan(without);
  });
});

describe('trimMessages', () => {
  it('keeps system message', () => {
    const msgs = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'a very long question with many many words that will surely exceed the token limit' },
    ];
    const limit = messagesTokenCount(msgs) - 5;
    const trimmed = trimMessages(msgs, limit);
    expect(trimmed).toHaveLength(1);
    expect(trimmed[0].role).toBe('system');
  });

  it('returns all if under limit', () => {
    const msgs = [{ role: 'user', content: 'hi' }];
    expect(trimMessages(msgs, 999)).toHaveLength(1);
  });

  it('drops oldest first', () => {
    const msgs = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
    ];
    const limit = messagesTokenCount(msgs) - 2;
    const trimmed = trimMessages(msgs, limit);
    expect(trimmed.length).toBeLessThan(msgs.length);
  });
});

// ══════════════════════════════════════════════
// agent (mocked)
// ══════════════════════════════════════════════
import { runAgent } from '../src/core/agent.js';

// mock api layer
vi.mock('../src/api/client.js', () => ({
  chatCompletion: vi.fn(),
}));
vi.mock('../src/api/stream.js', () => ({
  streamChatCompletion: vi.fn(),
}));

import { chatCompletion } from '../src/api/client.js';
import { streamChatCompletion } from '../src/api/stream.js';

// mock registry to return empty tool list
vi.mock('../src/tools/registry.js', () => ({
  default: {
    definitions: () => [],
    execute: vi.fn().mockResolvedValue('ok'),
  },
}));

describe('runAgent', () => {
  let dispatch;
  let state;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      messages: [{ role: 'user', content: 'hello' }],
      streaming: false,
      error: null,
    };
    dispatch = vi.fn();
  });

  it('dispatches START_STREAM, APPEND_CONTENT, FINISH_STREAM for simple reply', async () => {
    chatCompletion.mockResolvedValue({ body: {} });

    async function* fakeStream() {
      yield { content: 'Hi', tool_calls: null, finish_reason: null };
      yield { content: ' there', tool_calls: null, finish_reason: 'stop' };
    }
    streamChatCompletion.mockReturnValue(fakeStream());

    await runAgent({ dispatch, getState: () => state });

    const types = dispatch.mock.calls.map(c => c[0].type);
    expect(types).toContain(Action.START_STREAM);
    expect(types).toContain(Action.APPEND_CONTENT);
    expect(types).toContain(Action.FINISH_STREAM);
  });

  it('handles tool_calls and loops back', async () => {
    chatCompletion.mockResolvedValue({ body: {} });

    // first call: tool_calls
    async function* toolStream() {
      yield { content: null, tool_calls: [
        { index: 0, id: 'call_1', function: { name: 'echo', arguments: '{"msg":"hi"}' } },
      ], finish_reason: null };
      yield { content: null, tool_calls: null, finish_reason: 'tool_calls' };
    }
    // second call: stop
    async function* stopStream() {
      yield { content: 'done', tool_calls: null, finish_reason: 'stop' };
    }
    streamChatCompletion
      .mockReturnValueOnce(toolStream())
      .mockReturnValueOnce(stopStream());

    await runAgent({ dispatch, getState: () => state });

    const types = dispatch.mock.calls.map(c => c[0].type);
    expect(types).toContain(Action.SET_TOOL_CALLS);
    expect(types).toContain(Action.ADD_TOOL_RESULT);
    expect(types.filter(t => t === Action.START_STREAM)).toHaveLength(2);
    expect(types).toContain(Action.FINISH_STREAM);
  });

  it('catches errors and dispatches SET_ERROR', async () => {
    chatCompletion.mockRejectedValue(new Error('network error'));

    await runAgent({ dispatch, getState: () => state });

    const errorCall = dispatch.mock.calls.find(c => c[0].type === Action.SET_ERROR);
    expect(errorCall).toBeTruthy();
    expect(errorCall[0].error).toContain('network error');
  });
});
