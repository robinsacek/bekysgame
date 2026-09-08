const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

async function build() {
  const root = path.resolve(__dirname, '..');
  try {
    const result = await esbuild.build({
      entryPoints: [path.join(root, 'src', 'game.js')],
      bundle: true,
      minify: true,
      write: false,
      platform: 'browser',
      format: 'iife',
      target: ['safari15', 'chrome100', 'firefox100'],
      legalComments: 'inline',
      charset: 'ascii',
      loader: { '.mp3': 'dataurl' },
    });
    const template = fs.readFileSync(path.join(root, 'src', 'page.html'), 'utf8').replace(/\r\n/g, '\n');
    if (!template.includes('/* BLOB_ISLAND_BUNDLE */')) throw new Error('Missing bundle insertion marker.');
    const bundle = result.outputFiles[0].text.replace(/[ \t]+$/gm, '').replace(/<\/script/gi, '<\\/script');
    const notices = ['matter-js', 'lucide'].map(name => `${name}\n${fs.readFileSync(path.join(root, 'node_modules', name, 'LICENSE'), 'utf8')}`).join('\n\n') + '\n\n' + fs.readFileSync(path.join(root, 'assets', 'MUSIC-LICENSE.md'), 'utf8').replace(/\r\n/g, '\n');
    const html = template.replace('/* BLOB_ISLAND_BUNDLE */', () => bundle).replace('</body>', () => `<!-- Third-party notices\n${notices.replace(/--/g, '- -')}\n-->\n</body>`);
    if (/<script[^>]+src\s*=/i.test(html)) throw new Error('The output must not load external scripts.');
    fs.writeFileSync(path.join(root, 'index.html'), html);
    if (process.argv.includes('--pages')) {
      fs.mkdirSync(path.join(root, '_site'), { recursive: true });
      fs.writeFileSync(path.join(root, '_site', 'index.html'), html);
    }
    console.log(`Built standalone index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
  } finally {
    await esbuild.stop();
  }
}

build().catch(error => { console.error(error); process.exitCode = 1; });