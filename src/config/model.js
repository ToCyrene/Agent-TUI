const modelConfig = {
  //token cost in src/core/conversation.js
  tokenRatioCJK: 0.6,
  tokenRatioOther: 0.3,
  msgOverheadBase: 4,
  msgOverheadToolCall: 2,
  msgOverheadToolMsg: 1,
  framingOverhead: 3,

  //Maximum tool call count in src/core/agent.js
  maxToolIterations: 10,
};

export default modelConfig;
