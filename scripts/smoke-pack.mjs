// Packed-install smoke test: packs the package, installs it in a temp dir and runs the binary.
// It does not build: run `pnpm run build` first. It needs network access for `npm install`.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const win = process.platform === 'win32';
const npm = win ? 'npm.cmd' : 'npm';
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const binName = Object.keys(pkg.bin)[0];

function run(file, args, cwd, env) {
  return execFileSync(file, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // npm.cmd needs a shell on win32 since Node's CVE-2024-27980 fix; argv stays fixed.
    shell: false,
  });
}

function assertHelp(label, stdout) {
  if (!/Usage/.test(stdout)) {
    throw new Error(`${label}: stdout does not match /Usage/:\n${stdout}`);
  }
  console.log(`smoke-pack: ${label} ok`);
}

function main() {
  if (!existsSync(join(root, 'dist', 'main.js'))) {
    console.error('smoke-pack: dist/main.js is missing; run `pnpm run build` first');
    return 1;
  }
  const tmp = mkdtempSync(join(tmpdir(), 'shitaku-smoke-'));
  try {
    const env = { ...process.env, HOME: tmp, USERPROFILE: tmp };
    const packed = JSON.parse(run(npm, ['pack', '--ignore-scripts', '--pack-destination', tmp, '--json'], root, env));
    const tarball = join(tmp, packed[0].filename);

    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'smoke', private: true }));
    run(npm, ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball], tmp, env);

    const bin = join(tmp, 'node_modules', '.bin', win ? `${binName}.cmd` : binName);
    assertHelp(`${binName} --help`, run(bin, ['--help'], tmp, env));

    const main = join(tmp, 'node_modules', ...pkg.name.split('/'), 'dist', 'main.js');
    assertHelp('node dist/main.js --help', run(process.execPath, [main, '--help'], tmp, env));
    return 0;
  } catch (error) {
    console.error(`smoke-pack: failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

process.exit(main());
