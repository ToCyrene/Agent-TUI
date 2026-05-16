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
    expect(result).toBe('1 | hello world');
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

  it('truncates by lines and reports total line count', async () => {
    tools.readMaxBytes = 15;
    const lines = ['short', 'this line is too long', 'also too long here'];
    await fs.writeFile(path.join(tmpDir, 'big.txt'), lines.join('\n'));
    const result = await readFile.handler({ path: 'big.txt' });
    expect(result).toContain('1 | short');
    expect(result).toContain('[truncated: 1 of 3 lines]');
  });

  it('numbers lines with right-aligned padding', async () => {
    await fs.writeFile(path.join(tmpDir, 'multi.txt'), 'a\nbb\nccc\ndddd\neeeee\nffffff\nggggggg\nhhhhhhhh\niiiiiiiii\njjjjjjjjjj');
    const result = await readFile.handler({ path: 'multi.txt' });
    const expected = [
      ' 1 | a',
      ' 2 | bb',
      ' 3 | ccc',
      ' 4 | dddd',
      ' 5 | eeeee',
      ' 6 | ffffff',
      ' 7 | ggggggg',
      ' 8 | hhhhhhhh',
      ' 9 | iiiiiiiii',
      '10 | jjjjjjjjjj',
    ].join('\n');
    expect(result).toBe(expected);
  });
});

// ── write_file ──
import * as writeFile from '../src/tools/builtin/write-file.js';

describe('write_file', () => {
  it('writes a file', async () => {
    const result = await writeFile.handler({ path: 'out.txt', content: 'data' });
    expect(result).toContain('Wrote 1 lines');
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

  it('blocks overwriting files with >50 lines', async () => {
    const lines = Array.from({ length: 51 }, (_, i) => `line ${i}`);
    await fs.writeFile(path.join(tmpDir, 'large.txt'), lines.join('\n'));
    const result = await writeFile.handler({ path: 'large.txt', content: 'new' });
    expect(result).toContain('Use update_file');
  });
});

// ── update_file ──
import * as updateFile from '../src/tools/builtin/update-file.js';

describe('update_file', () => {
  it('single replace', async () => {
    await fs.writeFile(path.join(tmpDir, 'f.txt'), 'a\nb\nc\nd\ne\n');
    const result = await updateFile.handler({ path: 'f.txt', operation: 'replace', start_line: 2, end_line: 4, content: 'x\ny\nz' });
    expect(result).toContain('Replaced lines 2-4');
    expect(result).toContain('---');
    const content = await fs.readFile(path.join(tmpDir, 'f.txt'), 'utf-8');
    expect(content).toBe('a\nx\ny\nz\ne\n');
  });

  it('batch edits with index shifting', async () => {
    await fs.writeFile(path.join(tmpDir, 'f.txt'), '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n');
    // Replace line 8-9, then insert at line 3 — both use original line numbers
    const result = await updateFile.handler({
      path: 'f.txt',
      edits: [
        { operation: 'replace', start_line: 8, end_line: 9, content: 'eight\nnine' },
        { operation: 'insert', start_line: 3, content: 'inserted' },
      ],
    });
    expect(result).toContain('2 edits applied');
    expect(result).toContain('--- edit 1/2');
    expect(result).toContain('--- edit 2/2');
    expect(result).not.toContain('Error');
    const content = await fs.readFile(path.join(tmpDir, 'f.txt'), 'utf-8');
    expect(content).toBe('1\n2\n3\ninserted\n4\n5\n6\n7\neight\nnine\n10\n');
  });

  it('rejects overlapping edits', async () => {
    await fs.writeFile(path.join(tmpDir, 'f.txt'), '1\n2\n3\n4\n5\n');
    const result = await updateFile.handler({
      path: 'f.txt',
      edits: [
        { operation: 'replace', start_line: 2, end_line: 4, content: 'x' },
        { operation: 'insert', start_line: 3, content: 'y' },
      ],
    });
    expect(result).toContain('overlapping');
  });

  it('rejects multiple appends', async () => {
    await fs.writeFile(path.join(tmpDir, 'f.txt'), '1\n2\n');
    const result = await updateFile.handler({
      path: 'f.txt',
      edits: [
        { operation: 'append', content: 'a' },
        { operation: 'append', content: 'b' },
      ],
    });
    expect(result).toContain('at most one append');
  });

  it('backward compatible single op signature', async () => {
    await fs.writeFile(path.join(tmpDir, 'f.txt'), 'a\nb\nc\n');
    const result = await updateFile.handler({ path: 'f.txt', operation: 'insert', start_line: 0, content: 'before' });
    expect(result).toContain('Inserted 1 lines at line 0');
    const content = await fs.readFile(path.join(tmpDir, 'f.txt'), 'utf-8');
    expect(content).toBe('before\na\nb\nc\n');
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
