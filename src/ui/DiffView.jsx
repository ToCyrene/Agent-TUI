import React from 'react';
import { Box, Text } from 'ink';

function lineColor(line) {
  if (line.includes(' -  ')) return 'red';
  if (line.includes(' +  ')) return 'green';
  return undefined;
}

function DiffView({ content }) {
  const lines = content.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color={lineColor(line)}>{line}</Text>
      ))}
    </Box>
  );
}

export default React.memo(DiffView);
