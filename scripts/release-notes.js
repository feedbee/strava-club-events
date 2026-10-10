import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('Usage: node scripts/release-notes.js MAJOR.MINOR.PATCH');
}
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const sections = changelog.split(/(?=^## \[)/m);
const section = sections.find(value => value.startsWith(`## [${version}] - `));
if (!section) throw new Error(`No changelog entry for ${version}`);
process.stdout.write(section.trim() + '\n');
