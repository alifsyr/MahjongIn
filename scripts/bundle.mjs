import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const index = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'riichi.css'), 'utf8');
const js = readFileSync(join(root, 'riichi.js'), 'utf8');

const headBeforeCss = index.slice(0, index.indexOf('<link rel="stylesheet"'));
const bodyContent = index.slice(index.indexOf('<body>'));

const bundle = `${headBeforeCss}<style>\n${css}\n</style>\n  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>\n  <script>\n${js}\n</script>\n</head>\n${bodyContent}`;

const target = join(root, 'Mahjong-Riichi-4-Pemain.html');

if (process.argv.includes('--check')) {
  const current = readFileSync(target, 'utf8');
  if (current !== bundle) {
    console.error('❌ Standalone bundle Mahjong-Riichi-4-Pemain.html is out of sync with index.html, riichi.css, or riichi.js.');
    console.error('Run "npm run bundle" to update the bundle.');
    process.exit(1);
  }
  console.log('✅ Standalone bundle is up to date.');
} else {
  writeFileSync(target, bundle, 'utf8');
  console.log('✅ Mahjong-Riichi-4-Pemain.html successfully bundled. Size:', bundle.length, 'bytes');
}
