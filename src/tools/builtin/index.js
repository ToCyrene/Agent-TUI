import registry from '../registry.js';
import * as readFile from './read-file.js';
import * as writeFile from './write-file.js';
import * as runCommand from './run-command.js';

for (const mod of [readFile, writeFile, runCommand]) {
  registry.register({ definition: mod.definition, handler: mod.handler });
}
