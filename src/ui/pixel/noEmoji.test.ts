import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Emoji, dingbats, arrows and pictographic symbols (DESIGN_LANGUAGE 7.4). Typographic marks such as x, middle dot and dashes are fine.
const PICTOGRAPH = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('emoji ban', () => {
  it('no emoji or pictographic symbol anywhere in src (icons are pixel art)', () => {
    const offenders = sourceFiles('src').filter((file) => PICTOGRAPH.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
