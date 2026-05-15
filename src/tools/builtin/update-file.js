import fs from 'node:fs/promises';
import path from 'node:path';
import { tools } from '../../config/index.js';
import { defineTool } from '../schema.js';

export const definition = defineTool({
  name: 'update_file',
  description:
    'Edit specific parts of an existing file. Always read_file first to get correct line numbers. ' +
    'Use this (not write_file) for partial edits. ' +
    'Operations: replace (replace lines start-end with content), ' +
    'insert (insert content after start_line, use 0 for beginning), ' +
    'delete (remove lines start-end), append (add content at end). ' +
    'Set auto_newline=true for insert/append to auto-wrap content as proper lines.',
  parameters: {
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit (relative or absolute)',
      },
      operation: {
        type: 'string',
        enum: ['replace', 'insert', 'delete', 'append'],
        description: 'Type of edit to perform',
      },
      start_line: {
        type: 'number',
        description: 'Starting line number (1-indexed). Required for replace/insert/delete. Use 0 to insert before first line.',
      },
      end_line: {
        type: 'number',
        description: 'Ending line number (inclusive). Required for replace/delete.',
      },
      content: {
        type: 'string',
        description: 'New content for replace/insert/append. Use \\n for line breaks.',
      },
      auto_newline: {
        type: 'boolean',
        description: 'For insert/append: if true, tool auto-wraps content with line breaks to form independent lines. Default false.',
      },
    },
    required: ['path', 'operation'],
  },
});

function detectEOL(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function buildDiff({ contextBefore, oldLines, newLines, contextAfter, startLine }) {
  const allNums = [];
  for (const c of contextBefore) allNums.push(c.lineNum);
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) allNums.push(startLine + i);
  for (const c of contextAfter) allNums.push(c.lineNum);
  const width = String(allNums.length > 0 ? Math.max(...allNums) : startLine).length;
  const result = [];

  // context before — no \ marker, no -/+
  for (const ctx of contextBefore) {
    const num = String(ctx.lineNum).padStart(width);
    result.push(`  ${num}  ${ctx.content}`);
  }

  // removed lines — first one gets \ marker, rest aligned
  for (let i = 0; i < oldLines.length; i++) {
    const num = String(startLine + i).padStart(width);
    const isFirst = i === 0;
    const prefix = isFirst ? '\\ ' : '  ';
    result.push(`${prefix}${num} -  ${oldLines[i]}`);
  }

  // added lines — padded to align with - content
  const pad = ' '.repeat(width + 4);
  for (let i = 0; i < newLines.length; i++) {
    const num = String(startLine + i).padStart(width);
    if (oldLines.length === 0 && i === 0) {
      result.push(`\\ ${pad}${num} +  ${newLines[i]}`);
    } else {
      result.push(`${pad}${num} +  ${newLines[i]}`);
    }
  }

  // context after — no marker
  for (const ctx of contextAfter) {
    const num = String(ctx.lineNum).padStart(width);
    result.push(`  ${num}  ${ctx.content}`);
  }

  return result.join('\n');
}

function takeContextBefore(lines, startLine, count) {
  const ctx = [];
  for (let i = Math.max(0, startLine - count - 1); i < startLine - 1; i++) {
    ctx.push({ lineNum: i + 1, content: lines[i] });
  }
  return ctx;
}

export async function handler(args) {
  const root = tools.workDir;
  const resolved = path.resolve(root, args.path);

  if (!resolved.startsWith(root)) {
    return 'Error: access denied — path is outside project directory';
  }

  let raw;
  try {
    raw = await fs.readFile(resolved, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return `Error: file not found: ${args.path}`;
    }
    return `Error: ${err.message}`;
  }

  const isEmpty = raw.length === 0;
  const eol = isEmpty ? '\n' : detectEOL(raw);
  const normalized = isEmpty ? '' : raw.replace(/\r\n/g, '\n');
  const lines = isEmpty ? [] : normalized.split('\n');

  const op = args.operation;
  const startLine = args.start_line;
  const endLine = args.end_line;
  const newContent = args.content || '';

  let diffParams;

  switch (op) {
    case 'replace': {
      if (isEmpty) return 'Error: file is empty, nothing to replace';
      if (startLine == null || endLine == null) {
        return 'Error: replace requires start_line and end_line';
      }
      if (startLine < 1 || endLine < startLine || endLine > lines.length) {
        return `Error: invalid line range ${startLine}-${endLine}. File has ${lines.length} lines.`;
      }

      const oldLines = lines.slice(startLine - 1, endLine);
      const newLines = newContent === '' ? [] : newContent.split('\n');
      const contextBefore = takeContextBefore(lines, startLine, 2);
      const changed = [...lines.slice(0, startLine - 1), ...newLines, ...lines.slice(endLine)];

      const afterStart = startLine + newLines.length;
      const contextAfter = [];
      for (let i = endLine; i < Math.min(lines.length, endLine + 2); i++) {
        contextAfter.push({ lineNum: afterStart + (i - endLine), content: lines[i] });
      }

      diffParams = { contextBefore, oldLines, newLines, contextAfter, startLine };

      const out = changed.join('\n');
      const final = eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out;
      await fs.writeFile(resolved + '.tmp', final, 'utf-8');
      await fs.rename(resolved + '.tmp', resolved);
      break;
    }

    case 'insert': {
      if (startLine == null) {
        return 'Error: insert requires start_line (use 0 for beginning of file)';
      }
      if (!isEmpty && (startLine < 0 || startLine > lines.length)) {
        return `Error: invalid start_line ${startLine}. File has ${lines.length} lines. Use 0 for beginning.`;
      }

      const contentLines = newContent === '' ? [] : newContent.split('\n');

      let changed;
      let diffStart;
      if (isEmpty) {
        changed = contentLines;
        diffStart = 1;
      } else if (startLine === 0) {
        changed = [...contentLines, ...lines];
        diffStart = 1;
      } else {
        changed = [...lines.slice(0, startLine), ...contentLines, ...lines.slice(startLine)];
        diffStart = startLine + 1;
      }

      const contextBefore = isEmpty ? [] : takeContextBefore(lines, diffStart, 2);

      const afterLineNum = diffStart + contentLines.length;
      const contextAfter = [];
      if (!isEmpty) {
        for (let i = startLine; i < Math.min(lines.length, startLine + 2); i++) {
          const offset = i - startLine;
          contextAfter.push({ lineNum: afterLineNum + offset, content: lines[i] });
        }
      }

      diffParams = {
        contextBefore,
        oldLines: [],
        newLines: contentLines,
        contextAfter,
        startLine: diffStart,
      };

      const out = changed.join('\n');
      const final = eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out;
      await fs.writeFile(resolved + '.tmp', final, 'utf-8');
      await fs.rename(resolved + '.tmp', resolved);
      break;
    }

    case 'delete': {
      if (isEmpty) return 'Error: file is empty, nothing to delete';
      if (startLine == null || endLine == null) {
        return 'Error: delete requires start_line and end_line';
      }
      if (startLine < 1 || endLine < startLine || endLine > lines.length) {
        return `Error: invalid line range ${startLine}-${endLine}. File has ${lines.length} lines.`;
      }

      const oldLines = lines.slice(startLine - 1, endLine);
      const contextBefore = takeContextBefore(lines, startLine, 2);
      const changed = [...lines.slice(0, startLine - 1), ...lines.slice(endLine)];

      const contextAfter = [];
      for (let i = endLine; i < Math.min(lines.length, endLine + 2); i++) {
        contextAfter.push({ lineNum: startLine + (i - endLine), content: lines[i] });
      }

      diffParams = { contextBefore, oldLines, newLines: [], contextAfter, startLine };

      const out = changed.join('\n');
      const final = eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out;
      await fs.writeFile(resolved + '.tmp', final, 'utf-8');
      await fs.rename(resolved + '.tmp', resolved);
      break;
    }

    case 'append': {
      const contentLines = newContent === '' ? [] : newContent.split('\n');

      let changed;
      let diffStart;
      if (isEmpty) {
        changed = contentLines;
        diffStart = 1;
      } else {
        changed = [...lines, ...contentLines];
        diffStart = lines.length + 1;
      }

      const contextBefore = isEmpty ? [] : takeContextBefore(lines, diffStart, 2);

      diffParams = {
        contextBefore,
        oldLines: [],
        newLines: contentLines,
        contextAfter: [],
        startLine: diffStart,
      };

      const out = changed.join('\n');
      const final = eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out;
      await fs.writeFile(resolved + '.tmp', final, 'utf-8');
      await fs.rename(resolved + '.tmp', resolved);
      break;
    }

    default:
      return `Error: unknown operation '${op}'. Use replace, insert, delete, or append.`;
  }

  return buildDiff(diffParams);
}
