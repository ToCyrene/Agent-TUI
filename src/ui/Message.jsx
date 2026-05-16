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
    // update_file: stats + window + --- + diff
    const statsMatch = content && content.match(/^(\d+ edits applied|Replaced|Inserted|Deleted|Appended) .+\n\n/);
    if (statsMatch) {
      const statsText = statsMatch[0].trim();
      const sepIdx = content.indexOf('\n---\n');
      if (sepIdx !== -1) {
        const diffContent = content.slice(sepIdx + 5);
        const diffLines = diffContent ? diffContent.split('\n').length : 0;
        if (diffLines > 0 && diffLines <= tools.maxDiffLines) {
          return (
            <Box flexDirection="column">
              <Text>{statsText}</Text>
              <DiffView content={diffContent} />
            </Box>
          );
        }
      }
      return <Text>{statsText}</Text>;
    }

    const truncated = truncateLines(content);
    if (truncated && /\d [-+]  /.test(truncated)) {
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
