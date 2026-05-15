import React from 'react';
import { Box, Text } from 'ink';

function formatArgs(raw) {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function ToolCallCard({ id, name, arguments: rawArgs }) {
  const argsDisplay = formatArgs(rawArgs);

  return (
    <Box flexDirection="column" marginY={1}>
      <Text color="cyan" bold>  ● {name}</Text>
      {argsDisplay ? <Text dimColor>     {argsDisplay}</Text> : null}
    </Box>
  );
}

export default React.memo(ToolCallCard);
