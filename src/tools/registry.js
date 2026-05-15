const tools = new Map();

const registry = {
  register({ definition, handler }) {
    tools.set(definition.function.name, { definition, handler });
  },

  async execute(name, args) {
    const tool = tools.get(name);
    if (!tool) {
      return `Error: tool '${name}' not found`;
    }
    try {
      return await tool.handler(args);
    } catch (err) {
      return `Error: ${err.message}`;
    }
  },

  definitions() {
    return Array.from(tools.values(), (t) => t.definition);
  },
};

export default registry;
