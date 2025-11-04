import { promises as fs } from 'node:fs';
import path from 'node:path';

const target = path.resolve('static', 'builder', 'builder.js');
const code = await fs.readFile(target, 'utf8');
const stack = [];
const openers = new Map([
  ['{', '}'],
  ['[', ']'],
  ['(', ')']
]);
const closers = new Map(Array.from(openers.entries()).map(([o, c]) => [c, o]));

for (let index = 0; index < code.length; index += 1) {
  const char = code[index];
  if (openers.has(char)) {
    stack.push({ char, index });
  } else if (closers.has(char)) {
    if (!stack.length) {
      console.log('Unmatched closing bracket', char, 'at index', index);
      process.exit(0);
    }
    const expected = closers.get(char);
    const { char: opener, index: openerIndex } = stack.pop();
    if (opener !== expected) {
      console.log('Mismatched bracket: expected', openers.get(opener), 'for opener at', openerIndex, 'but found', char, 'at', index);
      process.exit(0);
    }
  }
}

if (stack.length) {
  console.log('Unmatched openers:', stack.slice(-10));
} else {
  console.log('All brackets matched.');
}
