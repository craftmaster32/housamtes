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
if (!fs.existsSync(webManifest)) {
  console.error(`✖ web/manifest.json not found at ${webManifest} — aborting deployment`);
  process.exit(1);
}
fs.copyFileSync(webManifest, path.join(distDir, 'manifest.json'));
console.log('✓ manifest.json copied to dist');

// 3. Fix @expo/vector-icons fonts for web
//    Expo's web export doesn't reliably register the icon fonts, so glyphs come
//    out as ▢/△ tofu. We embed EVERY icon font the app bundles (not just
//    Ionicons) as base64 @font-face rules under all the family-name aliases
//    @expo/vector-icons uses, then link one CSS file from every HTML page.
//    On the native iPhone build these load automatically — this is web-only.
console.log('\n▶ Embedding icon fonts for web...');

// Icon-font file base name → the CSS font-family names to declare for it.
// CSS family names are case-insensitive, so we only add genuinely distinct
// spellings (e.g. the hyphenated aliases expo registers at runtime).
const ICON_FONTS = {
  Ionicons: ['Ionicons'],
  MaterialCommunityIcons: ['MaterialCommunityIcons', 'material-community'],
  MaterialIcons: ['MaterialIcons', 'material'],
  FontAwesome: ['FontAwesome'],
  FontAwesome5_Brands: ['FontAwesome5_Brands', 'FontAwesome5Brands-Regular'],
  FontAwesome5_Regular: ['FontAwesome5_Regular', 'FontAwesome5Free-Regular'],
  FontAwesome5_Solid: ['FontAwesome5_Solid', 'FontAwesome5Free-Solid'],
  Feather: ['Feather'],
  AntDesign: ['AntDesign', 'anticon'],
  Entypo: ['Entypo'],
  EvilIcons: ['EvilIcons'],
  Foundation: ['Foundation'],
  Octicons: ['Octicons'],
  SimpleLineIcons: ['SimpleLineIcons', 'simple-line-icons'],
  Zocial: ['Zocial'],
  Fontisto: ['Fontisto'],
};

const assetsDir = path.join(distDir, 'assets');
const allAssets = fs.readdirSync(assetsDir, { recursive: true });
const fontsDir = path.join(distDir, 'fonts');
fs.mkdirSync(fontsDir, { recursive: true });

const cssBlocks = [];
const embedded = [];
for (const [baseName, families] of Object.entries(ICON_FONTS)) {
  const re = new RegExp(`(?:^|/)${baseName}\\.[a-f0-9]+\\.ttf$`);
  const asset = allAssets.find((f) => typeof f === 'string' && re.test(f));
  if (!asset) continue;
  const srcPath = path.join(assetsDir, asset);
  const cleanName = `${baseName.toLowerCase()}.ttf`;
  fs.copyFileSync(srcPath, path.join(fontsDir, cleanName));
  const b64 = fs.readFileSync(srcPath).toString('base64');
  for (const family of families) {
    cssBlocks.push(
      [
        '@font-face {',
        `  font-family: "${family}";`,
        `  src: url("data:font/truetype;base64,${b64}") format("truetype"),`,
        `       url("/fonts/${cleanName}") format("truetype");`,
        '  font-weight: normal;',
        '  font-style: normal;',
        '  font-display: block;',
        '}',
      ].join('\n')
    );
  }
  embedded.push(`${baseName} (${Math.round((b64.length * 0.75) / 1024)} KB)`);
}

if (embedded.length === 0) {
  console.warn('⚠ No icon fonts found in dist/assets — icons will be missing');
} else {
  // Keep the filename `ionicons.css` for backwards compatibility with the
  // injection check below; it now carries every icon font.
  fs.writeFileSync(
    path.join(fontsDir, 'ionicons.css'),
    `/* @expo/vector-icons web fonts — embedded so no network request is needed */\n${cssBlocks.join('\n')}\n`
  );

  function injectLink(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (
        entry.isDirectory() &&
        entry.name !== 'fonts' &&
        entry.name !== 'assets' &&
        entry.name !== '.vercel'
      ) {
        injectLink(full);
      } else if (entry.name.endsWith('.html')) {
        let html = fs.readFileSync(full, 'utf8');
        html = html.replace(/<style id="ionicons-font">.*?<\/style>/s, '');
        if (!html.includes('ionicons.css')) {
          html = html.replace('<head>', '<head><link rel="stylesheet" href="/fonts/ionicons.css">');
          fs.writeFileSync(full, html);
        }
      }
    }
  }
  injectLink(distDir);

  console.log(`✓ Embedded icon fonts: ${embedded.join(', ')}`);
}

// 4. Write vercel.json into dist so routing works correctly
//    SPA mode: every URL must fall through to index.html
const vercelConfig = {
  headers: [
    {
      // Security headers on every response — mirrors root vercel.json.
      // Vercel serves THIS generated file, so the headers must live here too.
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
      ],
    },
    {
      source: '/index.html',
      headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
    },
    {
      // Service worker must never be cached, so browsers pick up updates, and
      // needs Service-Worker-Allowed so it can control the whole origin.
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
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

// 4c. Copy the .vercel project link from root into dist, or create from env vars (CI)
if (fs.existsSync(rootVercel)) {
  if (fs.existsSync(distVercel)) fs.rmSync(distVercel, { recursive: true });
  fs.cpSync(rootVercel, distVercel, { recursive: true });
  console.log('✓ Vercel project link copied');
} else if (process.env.VERCEL_ORG_ID && process.env.VERCEL_PROJECT_ID) {
  fs.mkdirSync(distVercel, { recursive: true });
  fs.writeFileSync(
    path.join(distVercel, 'project.json'),
    JSON.stringify({ orgId: process.env.VERCEL_ORG_ID, projectId: process.env.VERCEL_PROJECT_ID })
  );
  console.log('✓ Vercel project link created from env vars');
} else {
  console.warn('\n⚠ No .vercel folder at root — run "vercel link" from c:/homeapp first');
}

// 5. Deploy
//    Production by default. Set VERCEL_PREVIEW=1 to publish a throwaway preview
//    deployment on a *.vercel.app URL instead — used to try a branch before it
//    merges, without touching the live housemates-five.vercel.app site.
const isPreview = !!process.env.VERCEL_PREVIEW;
console.log(`\n▶ Deploying to Vercel (${isPreview ? 'preview' : 'production'})...`);
const tokenFlag = process.env.VERCEL_TOKEN ? `--token ${process.env.VERCEL_TOKEN}` : '';
const prodFlag = isPreview ? '' : '--prod';

if (isPreview) {
  // Capture stdout so we can surface the generated preview URL to CI.
  const out = execSync(`vercel ${prodFlag} --yes ${tokenFlag}`.trim(), {
    cwd: distDir,
    encoding: 'utf8',
  });
  process.stdout.write(out);
  const url = (out.match(/https:\/\/[^\s]+\.vercel\.app/g) || []).pop();
  if (url) {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `preview_url=${url}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### 🔍 Preview URL\n\n${url}\n`);
    }
    console.log(`\n✓ Preview deployed: ${url}`);
  } else {
    console.log('\n✓ Preview deployed (URL not detected in output above)');
  }
} else {
  execSync(`vercel --prod --yes ${tokenFlag}`.trim(), { cwd: distDir, stdio: 'inherit' });
  console.log('\n✓ Done! housemates-five.vercel.app is live');
}
