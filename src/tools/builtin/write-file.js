import fs from 'node:fs/promises';
import path from 'node:path';
import { tools } from '../../config/index.js';
import { defineTool } from '../schema.js';

export const definition = defineTool({
  name: 'write_file',
  description: 'Create a new file or overwrite a file entirely. Do NOT use for editing parts of an existing file — use update_file for that.',
  parameters: {
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file (relative or absolute)',
      },
      content: {
        type: 'string',
        description: 'Content to write',
      },
    },
    required: ['path', 'content'],
  },
});

export async function handler({ path: filePath, content }) {
  const root = tools.workDir;
  const resolved = path.resolve(root, filePath);

  if (!resolved.startsWith(root)) {
    return 'Error: access denied — path is outside project directory';
  }

  try {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    return `File written: ${path.relative(root, resolved)}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
