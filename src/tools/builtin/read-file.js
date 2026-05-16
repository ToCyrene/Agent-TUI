import fs from 'node:fs/promises';
import path from 'node:path';
import { tools } from '../../config/index.js';
import { defineTool } from '../schema.js';
import { isBinaryFile } from 'isbinaryfile';

export const definition = defineTool({
  name: 'read_file',
  description: 'Read the contents of a file. Returns content with line numbers (format: "LINE | CONTENT"). When editing this file, you MUST use these line numbers with update_file.',
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
    const allLines = content.split('\n');
    const totalLines = allLines.length;

    const outLines = [];
    let bytes = 0;
    let truncated = false;
    for (const line of allLines) {
      const lineBytes = Buffer.byteLength(line, 'utf-8') + 1;
      if (bytes + lineBytes > tools.readMaxBytes) {
        truncated = true;
        break;
      }
      outLines.push(line);
      bytes += lineBytes;
    }

    if (outLines.length === 0) {
      if (truncated) return `…[truncated: 0 of ${totalLines} lines]`;
      return '';
    }

    const width = String(outLines.length).length;
    const numbered = outLines.map((line, i) => {
      const num = String(i + 1).padStart(width);
      return `${num} | ${line}`;
    }).join('\n');

    if (truncated) {
      return numbered + `\n…[truncated: ${outLines.length} of ${totalLines} lines]`;
    }
    return numbered;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
