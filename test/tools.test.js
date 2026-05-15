import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { defineTool } from '../src/tools/schema.js';
import { tools } from '../src/config/index.js';

let tmpDir;
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-tui-test-'));
  tools.workDir = tmpDir;
  tools.blockedPaths = ['.env', '.git', 'node_modules'];
  tools.readMaxBytes = 100_000;
  tools.commandTimeout = 5;
});

// ── schema ──
describe('defineTool', () => {
  it('produces OpenAI function calling format', () => {
    const result = defineTool({
      name: 'test_tool',
      description: 'A test tool',
      parameters: {
        properties: { x: { type: 'number' } },
        required: ['x'],
      },
    });
    expect(result).toEqual({
      type: 'function',
      function: {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: { x: { type: 'number' } },
          required: ['x'],
        },
      },
    });
  });

  it('auto-wraps type: object when missing', () => {
    const result = defineTool({
      name: 't',
      description: 'd',
      parameters: { properties: {} },
    });
    expect(result.function.parameters.type).toBe('object');
  });
});

// ── registry ──
function createRegistry() {
  const map = new Map();
  return {
    register({ definition, handler }) {
      map.set(definition.function.name, { definition, handler });
    },
    async execute(name, args) {
      const tool = map.get(name);
      if (!tool) return `Error: tool '${name}' not found`;
      try { return await tool.handler(args); } catch (err) { return `Error: ${err.message}`; }
    },
    definitions() {
      return Array.from(map.values(), (t) => t.definition);
    },
  };
}

describe('registry', () => {
  const def = defineTool({
    name: 'echo',
    description: 'Echoes back',
    parameters: { properties: { msg: { type: 'string' } }, required: ['msg'] },
  });

  it('register and definitions', () => {
    const r = createRegistry();
    r.register({ definition: def, handler: async () => 'ok' });
    expect(r.definitions()).toHaveLength(1);
  });

  it('execute calls handler', async () => {
    const r = createRegistry();
    r.register({ definition: def, handler: async ({ msg }) => `echo: ${msg}` });
    expect(await r.execute('echo', { msg: 'hello' })).toBe('echo: hello');
  });

  it('execute returns error for unknown tool', async () => {
    const r = createRegistry();
    expect(await r.execute('nope', {})).toContain('not found');
  });

  it('execute catches handler exceptions', async () => {
    const r = createRegistry();
    r.register({ definition: def, handler: async () => { throw new Error('boom'); } });
    expect(await r.execute('echo', {})).toBe('Error: boom');
  });
});

// ── read_file ──
import * as readFile from '../src/tools/builtin/read-file.js';

describe('read_file', () => {
  it('reads a file', async () => {
    await fs.writeFile(path.join(tmpDir, 'hello.txt'), 'hello world');
    const result = await readFile.handler({ path: 'hello.txt' });
    expect(result).toBe('hello world');
  });

  it('blocks .env', async () => {
    await fs.writeFile(path.join(tmpDir, '.env'), 'SECRET=1');
    const result = await readFile.handler({ path: '.env' });
    expect(result).toContain('access denied');
  });

  it('blocks path outside workDir', async () => {
    const result = await readFile.handler({ path: '/etc/passwd' });
    expect(result).toContain('access denied');
  });

  it('returns error for missing file', async () => {
    const result = await readFile.handler({ path: 'nope.txt' });
    expect(result).toContain('Error');
  });

  it('truncates large files', async () => {
    tools.readMaxBytes = 10;
    await fs.writeFile(path.join(tmpDir, 'big.txt'), 'x'.repeat(500));
    const result = await readFile.handler({ path: 'big.txt' });
    expect(result).toContain('[truncated]');
  });
});

// ── write_file ──
import * as writeFile from '../src/tools/builtin/write-file.js';

describe('write_file', () => {
  it('writes a file', async () => {
    const result = await writeFile.handler({ path: 'out.txt', content: 'data' });
    expect(result).toContain('File written');
    expect(await fs.readFile(path.join(tmpDir, 'out.txt'), 'utf-8')).toBe('data');
  });

  it('creates parent directories', async () => {
    await writeFile.handler({ path: 'sub/deep/file.txt', content: 'nested' });
    expect(await fs.readFile(path.join(tmpDir, 'sub/deep/file.txt'), 'utf-8')).toBe('nested');
  });

  it('blocks path outside workDir', async () => {
    const result = await writeFile.handler({ path: '/etc/hacked', content: 'bad' });
    expect(result).toContain('access denied');
  });
});

// ── run_command ──
import * as runCommand from '../src/tools/builtin/run-command.js';

describe('run_command', () => {
  it('executes a command', async () => {
    const result = await runCommand.handler({ command: 'echo hello' });
    expect(result).toContain('hello');
  });

  it('captures stderr', async () => {
    const result = await runCommand.handler({ command: 'echo err >&2' });
    expect(result).toContain('[stderr]');
  });

  it('reports exit code', async () => {
    const result = await runCommand.handler({ command: 'bash -c "exit 42"' });
    expect(result).toContain('[exit code 42]');
  });
});
