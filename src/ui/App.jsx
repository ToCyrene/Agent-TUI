import React, { useEffect, useReducer, useRef } from 'react';
import { Box, Text } from 'ink';
import { useStdout } from 'ink';
import { initialState, reducer, Action } from '../core/state.js';
import { runAgent } from '../core/agent.js';
import { healthCheck } from '../api/client.js';
import { model } from '../config/index.js';
import { messagesTokenCount } from '../core/conversation.js';
import ChatView from './ChatView.jsx';
import Input from './Input.jsx';

const initial = {
  ...initialState,
  messages: [{ role: 'system', content: model.systemPrompt }],
};

function Hr({ color = 'blue' }) {
  const { stdout } = useStdout();
  const cols = (stdout?.columns || process.stdout.columns || 80) - 2;
  return <Text color={color}>{'━'.repeat(Math.max(0, cols))}</Text>;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  function syncDispatch(action) {
    stateRef.current = reducer(stateRef.current, action);
    dispatch(action);
  }

  useEffect(() => {
    healthCheck()
      .then(() => syncDispatch({ type: Action.CONNECTED }))
      .catch(() => {}); // 静默失败，保持 Idle
  }, []);

  function handleSubmit(text) {
    syncDispatch({ type: Action.ADD_USER_MESSAGE, content: text });
    syncDispatch({ type: Action.CLEAR_ERROR });
    runAgent({ dispatch: syncDispatch, getState: () => stateRef.current });
  }

  let statusColor, statusLabel;
  if (state.error) {
    statusColor = 'red'; statusLabel = `Error: ${state.error}`;
  } else if (state.streaming) {
    statusColor = 'yellow'; statusLabel = 'Streaming';
  } else if (state.connected) {
    statusColor = 'green'; statusLabel = 'Ready';
  } else {
    statusColor = 'gray'; statusLabel = 'Idle';
  }

  const tokens = messagesTokenCount(state.messages);
  const { stdout } = useStdout();
  const cols = stdout?.columns || process.stdout.columns || 80;
  const statusStr = ` ● ${statusLabel}`;
  const tokensStr = `${tokens} tokens`;
  const contentWidth = cols - 2;
  const barLen = Math.max(0, contentWidth - statusStr.length - tokensStr.length - 4);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <ChatView messages={state.messages} streaming={state.streaming} />
      <Box flexDirection="column">
        <Hr />
        <Input onSubmit={handleSubmit} disabled={state.streaming} />
        <Box flexDirection="row">
          <Text color="blue">{'━'.repeat(barLen)}</Text>
          <Text dimColor>  </Text>
          <Text color={statusColor}>{statusStr}</Text>
          <Text dimColor>  {tokensStr}</Text>
        </Box>
      </Box>
    </Box>
  );
}
