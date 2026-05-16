import fs from 'node:fs/promises';
import path from 'node:path';
import { tools } from '../../config/index.js';
import { defineTool } from '../schema.js';

export const definition = defineTool({
  name: 'write_file',
  description: 'Create a new file or overwrite an existing small file. For files with >50 existing lines, overwriting is blocked — use update_file for targeted edits instead.',
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
    let existingLines = 0;
    try {
      const existing = await fs.readFile(resolved, 'utf-8');
      existingLines = existing.split('\n').length;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    if (existingLines > tools.writeMaxExistingLines) {
      return `Error: file has ${existingLines} lines (limit ${tools.writeMaxExistingLines}). Use update_file for targeted edits instead of overwriting a large file.`;
    }

    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    const totalLines = content.split('\n').length;
    return `Wrote ${totalLines} lines: ${path.relative(root, resolved)}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
