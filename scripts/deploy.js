const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const distVercel = path.join(distDir, '.vercel');
const rootVercel = path.join(root, '.vercel');

// 1. Clean dist so no stale static files remain, then build
console.log('\n▶ Cleaning dist...');
if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });
console.log('\n▶ Building web app...');
execSync('npx expo export --platform web', { cwd: root, stdio: 'inherit' });

// 2. Copy web/manifest.json into dist so PWA standalone mode works
const webManifest = path.join(root, 'web', 'manifest.json');
if (fs.existsSync(webManifest)) {
  fs.copyFileSync(webManifest, path.join(distDir, 'manifest.json'));
  console.log('✓ manifest.json copied to dist');
}

// 3. Fix Ionicons for web
//    - Copy the font to /fonts/ionicons.ttf (clean path, no node_modules)
//    - Base64-encode it into a standalone /fonts/ionicons.css file
//    - Link that CSS from every HTML file (one cached download, works in all browsers)
console.log('\n▶ Fixing Ionicons for web...');

const assetsDir = path.join(distDir, 'assets');
const allAssets = fs.readdirSync(assetsDir, { recursive: true });
const ioniconsAsset = allAssets.find(
  (f) => typeof f === 'string' && /Ionicons\.[a-f0-9]+\.ttf$/.test(f)
);

if (!ioniconsAsset) {
  console.warn('⚠ Ionicons.ttf not found — icons will be missing');
} else {
  const srcPath = path.join(assetsDir, ioniconsAsset);
  const fontsDir = path.join(distDir, 'fonts');
  fs.mkdirSync(fontsDir, { recursive: true });

  // Copy font to clean path
  fs.copyFileSync(srcPath, path.join(fontsDir, 'ionicons.ttf'));

  // Base64-encode the font and write a self-contained CSS file
  const fontB64 = fs.readFileSync(srcPath).toString('base64');
  const css = [
    '/* Ionicons web font — embedded so no network request is needed */',
    '@font-face {',
    '  font-family: "ionicons";',
    `  src: url("data:font/truetype;base64,${fontB64}") format("truetype"),`,
    '       url("/fonts/ionicons.ttf") format("truetype");',
    '  font-weight: normal;',
    '  font-style: normal;',
    '  font-display: block;',
    '}',
  ].join('\n');
  fs.writeFileSync(path.join(fontsDir, 'ionicons.css'), css);

  // Inject <link> into every HTML file
  function injectLink(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'fonts' && entry.name !== 'assets' && entry.name !== '.vercel') {
        injectLink(full);
      } else if (entry.name.endsWith('.html')) {
        let html = fs.readFileSync(full, 'utf8');
        // Remove old injection if present
        html = html.replace(/<style id="ionicons-font">.*?<\/style>/s, '');
        if (!html.includes('ionicons.css')) {
          html = html.replace('<head>', '<head><link rel="stylesheet" href="/fonts/ionicons.css">');
          fs.writeFileSync(full, html);
        }
      }
    }
  }
  injectLink(distDir);

  const kb = Math.round(fontB64.length * 0.75 / 1024);
  console.log(`✓ Ionicons embedded as base64 (${kb} KB) + fallback /fonts/ionicons.ttf`);
}

// 4. Write vercel.json into dist so routing works correctly
//    SPA mode: every URL must fall through to index.html
const vercelConfig = {
  headers: [
    {
      source: '/fonts/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        { key: 'Access-Control-Allow-Origin', value: '*' },
      ],
    },
    {
      source: '/assets/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        { key: 'Access-Control-Allow-Origin', value: '*' },
      ],
    },
  ],
  rewrites: [{ source: '/(.*)', destination: '/index.html' }],
};
fs.writeFileSync(
  path.join(distDir, 'vercel.json'),
  JSON.stringify(vercelConfig, null, 2)
);
console.log('\n✓ vercel.json written');

// 4b. Add manifest.json to Vercel headers so it's served with correct content-type
vercelConfig.headers.push({
  source: '/manifest.json',
  headers: [
    { key: 'Content-Type', value: 'application/manifest+json' },
    { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
  ],
});
fs.writeFileSync(
  path.join(distDir, 'vercel.json'),
  JSON.stringify(vercelConfig, null, 2)
);

// 4c. Copy the .vercel project link from root into dist
if (fs.existsSync(rootVercel)) {
  if (fs.existsSync(distVercel)) fs.rmSync(distVercel, { recursive: true });
  fs.cpSync(rootVercel, distVercel, { recursive: true });
  console.log('✓ Vercel project link copied');
} else {
  console.warn('\n⚠ No .vercel folder at root — run "vercel link" from c:/homeapp first');
}

// 5. Deploy

console.log('\n▶ Deploying to Vercel...');
execSync('vercel --prod --yes', { cwd: distDir, stdio: 'inherit' });

console.log('\n✓ Done! housemates-five.vercel.app is live');
