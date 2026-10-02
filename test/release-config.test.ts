import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('ci.yml reuse contract', () => {
  const ci = read('.github/workflows/ci.yml');

  it('is callable from other workflows and still runs on pull_request', () => {
    expect(ci).toMatch(/^on:\n(?:[ ]+.*\n|\n)*?[ ]+workflow_call:/m);
    expect(ci).toMatch(/^[ ]+pull_request:\n[ ]+branches: \[main\]/m);
  });

  it('never runs on push', () => {
    expect(ci).not.toMatch(/^[ ]+push:/m);
  });

  it('has no path filters, so docs-only pull requests still run', () => {
    expect(ci).not.toMatch(/^[ ]+paths(-ignore)?:/m);
  });

  it('uses a literal ci- concurrency group and cancels only pull_request runs', () => {
    expect(ci).toContain('group: ci-${{ github.ref }}');
    expect(ci).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });

  it('declares a single ci job with read-only contents', () => {
    const jobsBlock = ci.slice(ci.indexOf('\njobs:'));
    const jobNames = [...jobsBlock.matchAll(/^ {2}([\w-]+):\s*$/gm)].map((match) => match[1]);
    expect(jobNames).toEqual(['ci']);
    expect(ci).toMatch(/^permissions:\n[ ]+contents: read$/m);
  });
});

describe('CHANGELOG.md ignores', () => {
  it('is ignored by Prettier', async () => {
    const info = await prettier.getFileInfo(join(ROOT, 'CHANGELOG.md'), {
      ignorePath: join(ROOT, '.prettierignore'),
    });
    expect(info.ignored).toBe(true);
  });

  it('is ignored by ESLint', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    expect(await eslint.isPathIgnored(join(ROOT, 'CHANGELOG.md'))).toBe(true);
  });
});
