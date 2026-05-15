import { exec } from 'node:child_process';
import { tools } from '../../config/index.js';
import { defineTool } from '../schema.js';

export const definition = defineTool({
  name: 'run_command',
  description: 'Execute a shell command. Returns stdout and stderr output.',
  parameters: {
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to run',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default 30)',
      },
    },
    required: ['command'],
  },
});

export function handler({ command, timeout = tools.commandTimeout }) {
  return new Promise((resolve) => {
    const child = exec(
      command,
      { cwd: tools.workDir, timeout: timeout * 1000, maxBuffer: tools.commandMaxBuffer },
      (err, stdout, stderr) => {
        const parts = [];
        if (stdout) parts.push(stdout.trim());
        if (stderr) parts.push('[stderr]\n' + stderr.trim());
        if (err && err.killed) {
          parts.push(`[timeout after ${timeout}s]`);
        } else if (err) {
          parts.push(`[exit code ${err.code}]`);
        }
        resolve(parts.join('\n') || '(no output)');
      },
    );
  });
}
