import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';

// Real home access must be impossible: `os.homedir()` throws and HOME points to a temp dir.
// Code under test receives `homeDir` and `cwd` by injection (see test/helpers/tmp-paths.ts).
const tmpHome = mkdtempSync(join(tmpdir(), 'dotagent-home-'));
process.env['HOME'] = tmpHome;
process.env['USERPROFILE'] = tmpHome;

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  const homedir = (): never => {
    throw new Error('os.homedir() is forbidden in tests: inject homeDir instead');
  };
  return { ...actual, default: { ...actual, homedir }, homedir };
});
