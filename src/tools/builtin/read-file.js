import fs from 'node:fs/promises';
import path from 'node:path';
import { tools } from '../../config/index.js';
import { defineTool } from '../schema.js';
import { isBinaryFile } from 'isbinaryfile';

export const definition = defineTool({
  name: 'read_file',
  description: 'Read the contents of a file. Returns the file content as text.',
  parameters: {
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file (relative or absolute)',
      },
    },
    required: ['path'],
  },
});

export async function handler({ path: filePath }) {
  const root = tools.workDir;
  const resolved = path.resolve(root, filePath);

  if (!resolved.startsWith(root)) {
    return 'Error: access denied — path is outside project directory';
  }

  const relative = path.relative(root, resolved);
  if (tools.blockedPaths.some((p) => relative === p || relative.startsWith(p + path.sep))) {
    return `Error: access denied — '${relative}' is blocked`;
  }

  try {
    const binary = await isBinaryFile(resolved);
    if (binary) {
      return 'Error: cannot read binary files (only text files are allowed)';
    }
  } catch (err) {
    return `Error: failed to check file type — ${err.message}`;
  }

  try {
    const content = await fs.readFile(resolved, 'utf-8');
    if (content.length > tools.readMaxBytes) {
      return content.slice(0, tools.readMaxBytes) + '\n…[truncated]';
    }
    return content;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
