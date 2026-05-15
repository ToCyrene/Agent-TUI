export function defineTool({ name, description, parameters }) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: parameters.type ? parameters : { type: 'object', ...parameters },
    },
  };
}
