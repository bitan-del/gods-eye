/**
 * Generate Gods Eye app icons and theme preview image.
 * Usage: node scripts/gen-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');

// Gods Eye viewfinder-eye SVG on blue gradient background
function makeLogoSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 80 80" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4F8CFF"/>
      <stop offset="100%" stop-color="#3B6EE8"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="16" fill="url(#bg)"/>
  <!-- Viewfinder corners -->
  <path d="M18 14 L14 14 L14 18" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>
  <path d="M62 14 L66 14 L66 18" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>
  <path d="M18 66 L14 66 L14 62" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>
  <path d="M62 66 L66 66 L66 62" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>
  <!-- Crosshair ticks -->
  <line x1="40" y1="14" x2="40" y2="18" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <line x1="40" y1="62" x2="40" y2="66" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <line x1="14" y1="40" x2="18" y2="40" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <line x1="62" y1="40" x2="66" y2="40" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <!-- Eye shape (almond) -->
  <path d="M12 40 Q26 24 40 24 Q54 24 68 40 Q54 56 40 56 Q26 56 12 40 Z" fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="2.5"/>
  <!-- Iris circle -->
  <circle cx="40" cy="40" r="11" fill="rgba(255,255,255,0.25)" stroke="white" stroke-width="1.5"/>
  <!-- Pupil -->
  <circle cx="40" cy="40" r="6" fill="white"/>
  <!-- Highlight -->
  <circle cx="43" cy="37" r="2" fill="rgba(79,140,255,0.8)"/>
</svg>`;
}

// Theme preview card (180x112) — dark card with Gods Eye logo + "Gods Eye" text
function makeThemePreviewSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="112" viewBox="0 0 180 112">
  <defs>
    <linearGradient id="card-bg" x1="0" y1="0" x2="180" y2="112" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1a1a1a"/>
      <stop offset="100%" stop-color="#121212"/>
    </linearGradient>
    <linearGradient id="logo-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4F8CFF"/>
      <stop offset="100%" stop-color="#3B6EE8"/>
    </linearGradient>
  </defs>
  <!-- Card background -->
  <rect width="180" height="112" rx="8" fill="url(#card-bg)"/>
  <!-- macOS traffic lights -->
  <circle cx="14" cy="12" r="3" fill="#FF5F57"/>
  <circle cx="24" cy="12" r="3" fill="#FEBC2E"/>
  <circle cx="34" cy="12" r="3" fill="#28C840"/>
  <!-- Logo circle -->
  <g transform="translate(70, 22)">
    <rect width="40" height="40" rx="8" fill="url(#logo-bg)"/>
    <!-- Mini viewfinder corners -->
    <path d="M9 7 L7 7 L7 9" stroke="white" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>
    <path d="M31 7 L33 7 L33 9" stroke="white" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>
    <path d="M9 33 L7 33 L7 31" stroke="white" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>
    <path d="M31 33 L33 33 L33 31" stroke="white" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>
    <!-- Mini eye shape -->
    <path d="M6 20 Q13 12 20 12 Q27 12 34 20 Q27 28 20 28 Q13 28 6 20 Z" fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="1.2"/>
    <!-- Mini iris -->
    <circle cx="20" cy="20" r="5.5" fill="rgba(255,255,255,0.25)" stroke="white" stroke-width="0.8"/>
    <!-- Mini pupil -->
    <circle cx="20" cy="20" r="3" fill="white"/>
    <!-- Mini highlight -->
    <circle cx="21.5" cy="18.5" r="1" fill="rgba(79,140,255,0.8)"/>
  </g>
  <!-- "Gods Eye" text -->
  <text x="90" y="82" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" letter-spacing="0.5">Gods Eye</text>
  <!-- Subtle tagline -->
  <text x="90" y="98" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="8" font-weight="400">Default Theme</text>
</svg>`;
}

async function main() {
  console.log('Generating Gods Eye icons...');

  // 1. Generate app icon (1024x1024 PNG)
  const iconSvg = Buffer.from(makeLogoSvg(1024));
  const iconPng = await sharp(iconSvg).resize(1024, 1024).png().toBuffer();
  writeFileSync(join(ROOT, 'resources', 'app.png'), iconPng);
  console.log('  ✓ resources/app.png (1024x1024)');

  // 2. Generate theme preview (180x112 PNG)
  const previewSvg = Buffer.from(makeThemePreviewSvg());
  const previewPng = await sharp(previewSvg).resize(180, 112).png().toBuffer();
  writeFileSync(join(ROOT, 'src', 'renderer', 'assets', 'themes', 'default-theme.png'), previewPng);
  console.log('  ✓ src/renderer/assets/themes/default-theme.png (180x112)');

  // 3. Generate macOS .icns from the 1024 PNG
  const iconsetDir = join(ROOT, 'resources', 'app.iconset');
  if (existsSync(iconsetDir)) rmSync(iconsetDir, { recursive: true });
  mkdirSync(iconsetDir, { recursive: true });

  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const s of sizes) {
    const buf = await sharp(iconSvg).resize(s, s).png().toBuffer();
    writeFileSync(join(iconsetDir, `icon_${s}x${s}.png`), buf);
    // Retina variants (e.g., icon_16x16@2x.png = 32px)
    if (s <= 512) {
      const buf2x = await sharp(iconSvg).resize(s * 2, s * 2).png().toBuffer();
      writeFileSync(join(iconsetDir, `icon_${s}x${s}@2x.png`), buf2x);
    }
  }

  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${join(ROOT, 'resources', 'app.icns')}"`, { stdio: 'pipe' });
    console.log('  ✓ resources/app.icns');
  } catch (e) {
    console.warn('  ⚠ Failed to generate .icns:', e.message);
  }

  // Cleanup iconset
  rmSync(iconsetDir, { recursive: true, force: true });

  // 4. Generate Windows .ico (256x256 PNG embedded in ICO format)
  // sharp can output ico-compatible PNGs; for a proper .ico we embed the 256px PNG
  const ico256 = await sharp(iconSvg).resize(256, 256).png().toBuffer();
  // Simple ICO: single 256x256 PNG entry
  const icoBuffer = createIco([ico256]);
  writeFileSync(join(ROOT, 'resources', 'app.ico'), icoBuffer);
  console.log('  ✓ resources/app.ico');

  console.log('Done!');
}

/**
 * Create a minimal ICO file with PNG entries.
 * ICO format: 6-byte header + 16-byte directory entries + PNG data
 */
function createIco(pngBuffers) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;
  let dataOffset = headerSize + dirSize;

  // Header: reserved(2) + type(2, 1=ICO) + count(2)
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = ICO
  header.writeUInt16LE(numImages, 4); // count

  const dirEntries = [];
  const dataBuffers = [];

  for (const png of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(0, 0);    // width (0 = 256)
    entry.writeUInt8(0, 1);    // height (0 = 256)
    entry.writeUInt8(0, 2);    // color palette
    entry.writeUInt8(0, 3);    // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // data size
    entry.writeUInt32LE(dataOffset, 12); // data offset
    dirEntries.push(entry);
    dataBuffers.push(png);
    dataOffset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...dataBuffers]);
}

main().catch(console.error);
