import fs from 'node:fs/promises';
import path from 'node:path';
import { tools } from '../../config/index.js';
import { defineTool } from '../schema.js';

export const definition = defineTool({
  name: 'update_file',
  description:
    'Edit an existing file. Always read_file first to get correct line numbers. ' +
    'Use this (not write_file) for partial edits. ' +
    'Submit multiple edits AT ONCE via the edits array — the tool handles index shifting automatically; use original line numbers. ' +
    'Edits must not overlap. Operations: replace, insert, delete, append.',
  parameters: {
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit (relative or absolute)',
      },
      edits: {
        type: 'array',
        description: 'Array of edits to apply. Each edit: { operation, start_line?, end_line?, content? }. Use original line numbers.',
        items: {
          type: 'object',
          properties: {
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
              description: 'For insert/append: if true, tool auto-wraps content with line breaks. Default false.',
            },
          },
          required: ['operation'],
        },
      },
      operation: {
        type: 'string',
        enum: ['replace', 'insert', 'delete', 'append'],
        description: 'Single edit: type of edit to perform. Use edits array for multiple edits.',
      },
      start_line: {
        type: 'number',
        description: 'Single edit: starting line number (1-indexed). Required for replace/insert/delete.',
      },
      end_line: {
        type: 'number',
        description: 'Single edit: ending line number (inclusive). Required for replace/delete.',
      },
      content: {
        type: 'string',
        description: 'Single edit: new content for replace/insert/append.',
      },
      auto_newline: {
        type: 'boolean',
        description: 'Single edit: auto-wrap content with line breaks. Default false.',
      },
    },
    required: ['path'],
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
    result.push(`  ${num}    ${ctx.content}`);
  }

  // removed lines — first one gets \ marker, rest aligned
  for (let i = 0; i < oldLines.length; i++) {
    const num = String(startLine + i).padStart(width);
    const isFirst = i === 0;
    const prefix = isFirst ? '\\ ' : '  ';
    result.push(`${prefix}${num} -  ${oldLines[i]}`);
  }

  // added lines — same alignment as - lines
  for (let i = 0; i < newLines.length; i++) {
    const num = String(startLine + i).padStart(width);
    const isFirstChange = oldLines.length === 0 && i === 0;
    const prefix = isFirstChange ? '\\ ' : '  ';
    result.push(`${prefix}${num} +  ${newLines[i]}`);
  }

  // context after — no marker
  for (const ctx of contextAfter) {
    const num = String(ctx.lineNum).padStart(width);
    result.push(`  ${num}    ${ctx.content}`);
  }

  return result.join('\n');
}

function buildWindow({ changed, windowStart, windowEnd, markLine }) {
  const slice = changed.slice(windowStart - 1, windowEnd);
  const width = String(windowEnd).length;
  const result = [];
  for (let i = 0; i < slice.length; i++) {
    const num = String(windowStart + i).padStart(width);
    const isMark = windowStart + i === markLine;
    const prefix = isMark ? '\\ ' : '  ';
    result.push(`${prefix}${num} | ${slice[i]}`);
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

function editRange(edit) {
  switch (edit.operation) {
    case 'replace':
    case 'delete':
      return { start: edit.start_line, end: edit.end_line };
    case 'insert':
      return { start: edit.start_line + 0.5, end: edit.start_line + 0.5 };
    case 'append':
      return null;
  }
}

function editSortKey(edit) {
  if (edit.operation === 'append') return Infinity;
  if (edit.operation === 'insert') return edit.start_line + 0.5;
  return edit.start_line;
}

function overlapError(a, b) {
  const ra = editRange(a);
  const rb = editRange(b);
  if (!ra || !rb) return null;
  if (ra.start <= rb.end && rb.start <= ra.end) {
    return `Error: overlapping edits — ${a.operation} at ${a.start_line ?? '?'}-${a.end_line ?? '?'} conflicts with ${b.operation} at ${b.start_line ?? '?'}-${b.end_line ?? '?'}`;
  }
  return null;
}

function validateEdit(edit, lines, totalLines) {
  const op = edit.operation;
  const sl = edit.start_line;
  const el = edit.end_line;
  if (!['replace', 'insert', 'delete', 'append'].includes(op)) {
    return `Error: unknown operation '${op}'`;
  }
  switch (op) {
    case 'replace': {
      if (totalLines === 0) return 'Error: file is empty, nothing to replace';
      if (sl == null || el == null) return 'Error: replace requires start_line and end_line';
      if (sl < 1 || el < sl || el > totalLines) return `Error: invalid line range ${sl}-${el}. File has ${totalLines} lines.`;
      return null;
    }
    case 'delete': {
      if (totalLines === 0) return 'Error: file is empty, nothing to delete';
      if (sl == null || el == null) return 'Error: delete requires start_line and end_line';
      if (sl < 1 || el < sl || el > totalLines) return `Error: invalid line range ${sl}-${el}. File has ${totalLines} lines.`;
      return null;
    }
    case 'insert': {
      if (sl == null) return 'Error: insert requires start_line (use 0 for beginning of file)';
      if (totalLines > 0 && (sl < 0 || sl > totalLines)) return `Error: invalid start_line ${sl}. File has ${totalLines} lines. Use 0 for beginning.`;
      return null;
    }
    case 'append':
      return null;
  }
}

function applyEdit(edit, currentLines) {
  const op = edit.operation;
  const sl = edit.start_line;
  const el = edit.end_line;
  const newContent = edit.content || '';
  const isEmpty = currentLines.length === 0;

  let diffParams;
  let changed;
  let header;

  switch (op) {
    case 'replace': {
      const oldLines = currentLines.slice(sl - 1, el);
      const newLines = newContent === '' ? [] : newContent.split('\n');
      const contextBefore = takeContextBefore(currentLines, sl, 2);
      changed = [...currentLines.slice(0, sl - 1), ...newLines, ...currentLines.slice(el)];

      const afterStart = sl + newLines.length;
      const contextAfter = [];
      for (let i = el; i < Math.min(currentLines.length, el + 2); i++) {
        contextAfter.push({ lineNum: afterStart + (i - el), content: currentLines[i] });
      }

      diffParams = { contextBefore, oldLines, newLines, contextAfter, startLine: sl };
      header = `Replaced lines ${sl}-${el}`;
      break;
    }

    case 'insert': {
      const contentLines = newContent === '' ? [] : newContent.split('\n');
      let diffStart;
      if (isEmpty) {
        changed = contentLines;
        diffStart = 1;
      } else if (sl === 0) {
        changed = [...contentLines, ...currentLines];
        diffStart = 1;
      } else {
        changed = [...currentLines.slice(0, sl), ...contentLines, ...currentLines.slice(sl)];
        diffStart = sl + 1;
      }

      const contextBefore = isEmpty ? [] : takeContextBefore(currentLines, diffStart, 2);
      const afterLineNum = diffStart + contentLines.length;
      const contextAfter = [];
      if (!isEmpty) {
        for (let i = sl; i < Math.min(currentLines.length, sl + 2); i++) {
          const offset = i - sl;
          contextAfter.push({ lineNum: afterLineNum + offset, content: currentLines[i] });
        }
      }

      diffParams = { contextBefore, oldLines: [], newLines: contentLines, contextAfter, startLine: diffStart };
      const at = sl === 0 ? 0 : sl;
      header = `Inserted ${contentLines.length} lines at line ${at}`;
      break;
    }

    case 'delete': {
      const oldLines = currentLines.slice(sl - 1, el);
      const contextBefore = takeContextBefore(currentLines, sl, 2);
      changed = [...currentLines.slice(0, sl - 1), ...currentLines.slice(el)];

      const contextAfter = [];
      for (let i = el; i < Math.min(currentLines.length, el + 2); i++) {
        contextAfter.push({ lineNum: sl + (i - el), content: currentLines[i] });
      }

      diffParams = { contextBefore, oldLines, newLines: [], contextAfter, startLine: sl };
      header = `Deleted lines ${sl}-${el}`;
      break;
    }

    case 'append': {
      const contentLines = newContent === '' ? [] : newContent.split('\n');
      let diffStart;
      if (isEmpty) {
        changed = contentLines;
        diffStart = 1;
      } else {
        changed = [...currentLines, ...contentLines];
        diffStart = currentLines.length + 1;
      }

      const contextBefore = isEmpty ? [] : takeContextBefore(currentLines, diffStart, 2);
      diffParams = { contextBefore, oldLines: [], newLines: contentLines, contextAfter: [], startLine: diffStart };
      header = `Appended ${contentLines.length} lines`;
      break;
    }
  }

  const added = diffParams.newLines.length;
  const removed = diffParams.oldLines.length;
  return { changed, diffParams, header, added, removed, netChange: added - removed };
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
  const originalLines = isEmpty ? [] : normalized.split('\n');

  // Normalize to edits array
  const edits = args.edits
    ? args.edits
    : [{ operation: args.operation, start_line: args.start_line, end_line: args.end_line, content: args.content, auto_newline: args.auto_newline }];

  if (!edits || edits.length === 0) {
    return 'Error: no edits provided';
  }

  const appendCount = edits.filter(e => e.operation === 'append').length;
  if (appendCount > 1) {
    return 'Error: at most one append operation is allowed';
  }

  // Validate — all line numbers refer to original file
  for (const edit of edits) {
    const err = validateEdit(edit, originalLines, originalLines.length);
    if (err) return err;
  }

  // Check overlaps
  for (let i = 0; i < edits.length; i++) {
    for (let j = i + 1; j < edits.length; j++) {
      const err = overlapError(edits[i], edits[j]);
      if (err) return err;
    }
  }

  // Sort by position descending (process from bottom to top)
  const sorted = [...edits].sort((a, b) => editSortKey(b) - editSortKey(a));

  // Apply edits sequentially
  let currentLines = [...originalLines];
  const results = [];
  for (const edit of sorted) {
    const res = applyEdit(edit, currentLines);
    currentLines = res.changed;
    results.push({ ...res, origPos: editSortKey(edit), operation: edit.operation });
  }

  // Write final file
  const out = currentLines.join('\n');
  const final = eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out;
  await fs.writeFile(resolved + '.tmp', final, 'utf-8');
  await fs.rename(resolved + '.tmp', resolved);

  const totalLines = currentLines.length;

  // Compute final positions — results are in descending original position order.
  // For output, we want ascending (top to bottom). Final position of each edit =
  //   original position + sum of net changes from edits with LOWER original position.
  const outputOrder = results.map((r, idx) => {
    // original position is the sort key before the edit
    let origPos = r.origPos;
    // edits with lower original position are those AFTER idx in results (since results is descending)
    let shift = 0;
    for (let j = idx + 1; j < results.length; j++) {
      if (results[j].origPos < origPos) shift += results[j].netChange;
    }
    const finalStart = Math.round(origPos + shift);
    return { ...r, finalStart };
  });

  // Sort by finalStart ascending for output
  outputOrder.sort((a, b) => a.finalStart - b.finalStart);

  // Build code windows from final file
  const windows = [];
  for (const r of outputOrder) {
    const newLines = r.diffParams.newLines;
    const addedLines = newLines.length;
    // The edit region in final file: starts at finalStart, spans addedLines lines
    const ws = Math.max(1, r.finalStart - 2);
    const we = Math.min(currentLines.length, r.finalStart + Math.max(addedLines, 1) - 1 + 2);
    const mark = r.finalStart;
    const win = buildWindow({ changed: currentLines, windowStart: ws, windowEnd: we, markLine: mark });
    windows.push({ header: r.header, window: win, finalStart: r.finalStart });
  }

  // Build output
  const totalEdits = edits.length;
  let outText;
  if (totalEdits === 1) {
    outText = `${windows[0].header} (${totalLines} lines total)\n\n${windows[0].window}`;
  } else {
    const headerLine = `${totalEdits} edits applied (${totalLines} lines total)`;
    const windowSections = windows.map((w, i) =>
      `--- edit ${i + 1}/${totalEdits}: ${w.header} ---\n${w.window}`
    ).join('\n\n');
    outText = `${headerLine}\n\n${windowSections}`;
  }

  // Append all diffs (ascending order, matching windows)
  const allDiffs = outputOrder.map(r => buildDiff({ ...r.diffParams, startLine: r.finalStart })).join('\n');
  return `${outText}\n---\n${allDiffs}`;
}
