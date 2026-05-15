export const initialState = {
  messages: [],
  streaming: false,
  error: null,
  connected: false,
};

export const Action = {
  ADD_USER_MESSAGE: 'ADD_USER_MESSAGE',
  START_STREAM: 'START_STREAM',
  APPEND_CONTENT: 'APPEND_CONTENT',
  SET_TOOL_CALLS: 'SET_TOOL_CALLS',
  FINISH_STREAM: 'FINISH_STREAM',
  ADD_TOOL_RESULT: 'ADD_TOOL_RESULT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  CONNECTED: 'CONNECTED',
};

export function reducer(state, action) {
  switch (action.type) {
    case Action.ADD_USER_MESSAGE:
      return {
        ...state,
        messages: [...state.messages, { role: 'user', content: action.content }],
      };

    case Action.START_STREAM: {
      if (state.streaming) return state;
      return {
        ...state,
        streaming: true,
        messages: [...state.messages, { role: 'assistant', content: '' }],
      };
    }

    case Action.APPEND_CONTENT: {
      if (!state.streaming) return state;
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role !== 'assistant') return state;
      msgs[msgs.length - 1] = { ...last, content: last.content + action.content };
      return { ...state, messages: msgs };
    }

    case Action.SET_TOOL_CALLS: {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role !== 'assistant') return state;
      msgs[msgs.length - 1] = { ...last, tool_calls: action.toolCalls };
      return { ...state, messages: msgs };
    }

    case Action.FINISH_STREAM:
      return { ...state, streaming: false, connected: true };

    case Action.ADD_TOOL_RESULT:
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'tool', content: action.content, tool_call_id: action.toolCallId },
        ],
      };

    case Action.SET_ERROR:
      return { ...state, streaming: false, error: action.error };

    case Action.CLEAR_ERROR:
      return { ...state, error: null };

    case Action.CONNECTED:
      return { ...state, connected: true };

    default:
      return state;
  }
}
