import React from 'react';
import { Box, Text } from 'ink';
import ToolCallCard from './ToolCallCard.jsx';
import DiffView from './DiffView.jsx';
import { tools } from '../config/index.js';

function truncateLines(text) {
  if (!text) return text;
  const maxLines = tools.maxToolOutputLines;
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  const omitted = lines.length - maxLines;
  return lines.slice(0, maxLines).join('\n') + `\n... +${omitted} lines`;
}

function Message({ role, content, tool_calls, tool_call_id }) {
  if (role === 'user') {
    return <Text bold color="green">{'>'} {content}</Text>;
  }

  if (role === 'tool') {
    const truncated = truncateLines(content);
    if (truncated && truncated.startsWith('\\ ')) {
      return <DiffView content={truncated} />;
    }
    return <Text dimColor>{truncated}</Text>;
  }

  if (role === 'assistant') {
    if (!content && !tool_calls?.length) return null;

    const hasThought = content && tool_calls?.length;

    return (
      <Box flexDirection="column">
        {hasThought ? (
          <Text dimColor>{'\n'}● Thought: {content}</Text>
        ) : content ? (
          <Text>{'\n'}● {content}</Text>
        ) : null}
        {tool_calls?.map(tc => (
          <ToolCallCard key={tc.id} id={tc.id} name={tc.function.name} arguments={tc.function.arguments} />
        ))}
      </Box>
    );
  }

  return null;
}

export default React.memo(Message);
