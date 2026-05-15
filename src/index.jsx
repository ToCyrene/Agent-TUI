import './tools/builtin/index.js';
import React from 'react';
import { render } from 'ink';
import App from './ui/App.jsx';
import serverConfig from './config/server.js';

const Y = '\x1b[33m';
const R = '\x1b[0m';
const lines = [
  `${Y} ▐▛███▜▌${R}   Agent TUI`,
  `${Y}▝▜█████▛▘${R}  ${serverConfig.model}`,
  `${Y}  ▘▘ ▝▝${R}    ${process.env.INIT_CWD || process.cwd()}`,
];

console.log(lines.join('\n'));

render(<App />);
