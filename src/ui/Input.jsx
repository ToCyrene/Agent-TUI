import React, { useReducer, useRef } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

function reducer(state, action) {
  switch (action.type) {
    case 'INSERT': {
      const { value, cursor } = state;
      return {
        value: value.slice(0, cursor) + action.char + value.slice(cursor),
        cursor: cursor + action.char.length,
      };
    }
    case 'BACKSPACE': {
      const { value, cursor } = state;
      if (cursor === 0) return state;
      return {
        value: value.slice(0, cursor - 1) + value.slice(cursor),
        cursor: cursor - 1,
      };
    }
    case 'DELETE': {
      const { value, cursor } = state;
      if (cursor >= value.length) return state;
      return {
        value: value.slice(0, cursor) + value.slice(cursor + 1),
        cursor,
      };
    }
    case 'MOVE':
      return { ...state, cursor: Math.max(0, Math.min(state.value.length, action.cursor)) };
    case 'CLEAR':
      return { value: '', cursor: 0 };
    default:
      return state;
  }
}

const initialState = { value: '', cursor: 0 };

function Input({ onSubmit, disabled = false }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);

  // 同步推进 ref：dispatch 后 React 可能批量延迟 render，
  // 但下一次 useInput 回调需要立即读到最新 state
  function syncDispatch(action) {
    stateRef.current = reducer(stateRef.current, action);
    dispatch(action);
  }

  const { value, cursor } = state;

  useInput((input, key) => {
    if (disabled) return;
    const cur = stateRef.current;

    if (key.return) {
      const text = cur.value.trim();
      if (text) {
        onSubmit(text);
        syncDispatch({ type: 'CLEAR' });
      }
    } else if (key.escape) {
      syncDispatch({ type: 'CLEAR' });
    } else if (key.leftArrow) {
      if (cur.cursor > 0) syncDispatch({ type: 'MOVE', cursor: cur.cursor - 1 });
    } else if (key.rightArrow) {
      if (cur.cursor < cur.value.length) syncDispatch({ type: 'MOVE', cursor: cur.cursor + 1 });
    } else if (key.backspace) {
      syncDispatch({ type: 'BACKSPACE' });
    } else if (key.delete) {
      syncDispatch({ type: 'DELETE' });
    } else if (input && !key.ctrl && !key.meta) {
      syncDispatch({ type: 'INSERT', char: input });
    }
  });

  const before = value.slice(0, cursor);
  const at = value[cursor];
  const after = cursor < value.length ? value.slice(cursor + 1) : '';

  return (
    <Box>
      <Text color="blue">> </Text>
      {disabled ? (
        <Text>{value}</Text>
      ) : (
        <Text>
          {before}
          {at != null ? (
            <Text backgroundColor="cyan" color="black">{at}</Text>
          ) : (
            <Text dimColor>█</Text>
          )}
          {after}
        </Text>
      )}
    </Box>
  );
}

export default Input;
