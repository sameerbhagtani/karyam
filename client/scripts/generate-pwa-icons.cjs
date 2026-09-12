const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const publicDir = path.resolve(__dirname, '../public');
const svgPath = path.resolve(publicDir, 'favicon.svg');

async function generateIcons() {
  console.log('Generating PWA icons from SVG...');
  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Standard 192x192
  await sharp(svgBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.resolve(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 2. Standard 512x512
  await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.resolve(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 3. Apple Touch Icon 180x180 (with subtle background for iOS icons)
  const appleInner = await sharp(svgBuffer)
    .resize(130, 130, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: '#0d0f17'
    }
  })
    .composite([{ input: appleInner, gravity: 'center' }])
    .png()
    .toFile(path.resolve(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 4. Maskable 192x192 (safe zone is inner 80%, so size ~124px on solid #0d0f17 bg)
  const maskableInner192 = await sharp(svgBuffer)
    .resize(124, 124, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: '#0d0f17'
    }
  })
    .composite([{ input: maskableInner192, gravity: 'center' }])
    .png()
    .toFile(path.resolve(publicDir, 'pwa-maskable-192x192.png'));
  console.log('Generated pwa-maskable-192x192.png');

  // 5. Maskable 512x512 (safe zone inner 80%, size ~330px on solid #0d0f17 bg)
  const maskableInner512 = await sharp(svgBuffer)
    .resize(330, 330, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: '#0d0f17'
    }
  })
    .composite([{ input: maskableInner512, gravity: 'center' }])
    .png()
    .toFile(path.resolve(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  console.log('All PWA icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
