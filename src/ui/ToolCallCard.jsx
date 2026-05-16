import React from 'react';
import { Box, Text } from 'ink';
import { tools } from '../config/index.js';

function truncateLines(text) {
  if (!text) return text;
  const maxLines = tools.maxToolOutputLines;
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  const omitted = lines.length - maxLines;
  return lines.slice(0, maxLines).join('\n') + `\n... +${omitted} lines`;
}

function parseArgs(raw) {
  if (!raw) return { inline: null, body: null };
  let args;
  try { args = JSON.parse(raw); } catch { return { inline: raw, body: null }; }

  const filtered = Object.entries(args).filter(([k]) => k !== 'timeout');
  if (filtered.length === 0) return { inline: null, body: null };

  const primaryKey = args.command ? 'command' : args.path ? 'path' : filtered[0][0];
  const inline = args[primaryKey];

  const remaining = filtered.filter(([k]) => k !== primaryKey);
  if (remaining.length === 0) return { inline, body: null };

  const lines = [];
  for (const [k, v] of remaining) {
    if (k === 'content') {
      lines.push(v);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  return { inline, body: '\n' + lines.join('\n') };
}

function ToolCallCard({ id, name, arguments: rawArgs }) {
  const { inline, body } = parseArgs(rawArgs);
  const truncatedBody = name === 'update_file' ? null : truncateLines(body);

  return (
    <Box flexDirection="column" marginY={1}>
      <Text color="cyan" bold>● {name}{inline ? `(${inline})` : ''}</Text>
      {truncatedBody ? <Text dimColor>{truncatedBody}</Text> : null}
    </Box>
  );
}

export default React.memo(ToolCallCard);
