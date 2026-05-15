const modelConfig = {
  systemPrompt: [
    'You are a helpful AI assistant running in a terminal.',
    'You can use tools to read/write files and run shell commands.',
    'When running commands, always provide explicit arguments — never pass empty objects.',
    'Be concise. Answer in the user\'s language.',
  ].join(' '),

  //token cost in src/core/conversation.js
  tokenRatioCJK: 0.6,
  tokenRatioOther: 0.3,
  msgOverheadBase: 4,
  msgOverheadToolCall: 2,
  msgOverheadToolMsg: 1,
  framingOverhead: 3,

  maxContextTokens: 128_000,

  //Maximum tool call count in src/core/agent.js
  maxToolIterations: 10,
};

export default modelConfig;
