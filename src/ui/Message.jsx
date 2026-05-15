import React from 'react';
import { Box, Text } from 'ink';
import ToolCallCard from './ToolCallCard.jsx';

const MAX_LINES = 3;

function truncateLines(text) {
  if (!text) return text;
  const lines = text.split('\n');
  if (lines.length <= MAX_LINES) return text;
  return lines.slice(0, MAX_LINES).join('\n') + '\n...';
}

function Message({ role, content, tool_calls, tool_call_id }) {
  if (role === 'user') {
    return <Text bold color="green">{'>'} {content}</Text>;
  }

  if (role === 'tool') {
    const truncated = truncateLines(content);
    return <Text dimColor>  ● {tool_call_id}: {truncated}</Text>;
  }

  if (role === 'assistant') {
    if (!content && !tool_calls?.length) return null;
    return (
      <Box flexDirection="column">
        {content ? <Text>{content}</Text> : null}
        {tool_calls?.map(tc => (
          <ToolCallCard key={tc.id} id={tc.id} name={tc.function.name} arguments={tc.function.arguments} />
        ))}
      </Box>
    );
  }

  return null;
}

export default React.memo(Message);
