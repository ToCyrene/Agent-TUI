import React from 'react';
import { Box, Static } from 'ink';
import Message from './Message.jsx';

function ChatView({ messages, streaming }) {
  const liveIndex = streaming && messages.length > 0 ? messages.length - 1 : -1;
  const staticMessages = liveIndex >= 0 ? messages.slice(0, liveIndex) : messages;
  const liveMessage = liveIndex >= 0 ? messages[liveIndex] : null;

  return (
    <Box flexDirection="column" flexGrow={1} gap={1}>
      <Static items={staticMessages}>
        {(msg, i) => (
          <Message
            key={i}
            role={msg.role}
            content={msg.content}
            tool_calls={msg.tool_calls}
            tool_call_id={msg.tool_call_id}
          />
        )}
      </Static>
      {liveMessage ? (
        <Message
          role={liveMessage.role}
          content={liveMessage.content}
          tool_calls={liveMessage.tool_calls}
          tool_call_id={liveMessage.tool_call_id}
        />
      ) : null}
    </Box>
  );
}

export default React.memo(ChatView);
