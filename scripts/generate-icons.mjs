#!/usr/bin/env node

/**
 * Icon Generation Script
 * 
 * OBS Multi-Platform Streaming için tüm platform icon formatlarını oluşturur:
 * - Windows: icon.ico (16, 32, 48, 64, 128, 256 boyutlarında)
 * - macOS: icon.icns (çeşitli boyutlarda)
 * - Linux: icon.png (256x256)
 * 
 * Kullanım: npm run generate-icons
 */

import sharp from 'sharp';
import toIco from 'to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(projectRoot, 'assets');
const iconPath = path.join(assetsDir, 'icon.png');

/**
 * OBS Multi-Platform Streaming için SVG icon oluşturur
 */
function createIconSVG() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#9146FF;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#FF0000;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4285F4;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background Circle -->
  <circle cx="256" cy="256" r="240" fill="url(#grad1)" opacity="0.9"/>
  
  <!-- Inner Circle -->
  <circle cx="256" cy="256" r="200" fill="#1a1a1a" stroke="#fff" stroke-width="4"/>
  
  <!-- Play/Stream Icon (Center) -->
  <path d="M 200 180 L 200 332 L 332 256 Z" fill="#fff" opacity="0.95"/>
  
  <!-- Multi-Platform Indicators (Small circles around) -->
  <circle cx="150" cy="150" r="30" fill="#9146FF" stroke="#fff" stroke-width="3"/>
  <circle cx="362" cy="150" r="30" fill="#FF0000" stroke="#fff" stroke-width="3"/>
  <circle cx="150" cy="362" r="30" fill="#1877F2" stroke="#fff" stroke-width="3"/>
  <circle cx="362" cy="362" r="30" fill="#FF6B00" stroke="#fff" stroke-width="3"/>
  
  <!-- Streaming Waves -->
  <path d="M 120 120 Q 130 115 140 120" stroke="#fff" stroke-width="3" fill="none" opacity="0.7"/>
  <path d="M 120 392 Q 130 397 140 392" stroke="#fff" stroke-width="3" fill="none" opacity="0.7"/>
  <path d="M 372 120 Q 382 115 392 120" stroke="#fff" stroke-width="3" fill="none" opacity="0.7"/>
  <path d="M 372 392 Q 382 397 392 392" stroke="#fff" stroke-width="3" fill="none" opacity="0.7"/>
</svg>
`;
}

/**
 * Icon.png dosyasının geçerli olup olmadığını kontrol eder
 */
async function validateIconFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    const metadata = await sharp(filePath).metadata();
    return metadata.width > 0 && metadata.height > 0;
  } catch (error) {
    return false;
  }
}

/**
 * SVG'den icon.png oluşturur
 */
async function createIconFromSVG() {
  console.log('📝 Mevcut icon.png geçersiz veya bulunamadı.');
  console.log('   SVG\'den yeni icon.png oluşturuluyor...\n');

  const svg = createIconSVG();
  const svgBuffer = Buffer.from(svg);

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(iconPath);

  console.log(`   ✅ icon.png oluşturuldu (512x512)\n`);
}

/**
 * Icon generation işlemini yönetir
 */
async function generateIcons() {
  console.log('🎨 Icon Generation Başlatılıyor...\n');

  // Kaynak icon.png kontrolü - yoksa veya geçersizse SVG'den oluştur
  const isValidIcon = await validateIconFile(iconPath);
  
  if (!isValidIcon) {
    await createIconFromSVG();
  }

  try {
    const image = sharp(iconPath);
    const metadata = await image.metadata();
    console.log(`📸 Kaynak: ${path.basename(iconPath)} (${metadata.width}x${metadata.height})`);

    // ICO için gerekli boyutlar (Windows)
    const icoSizes = [16, 32, 48, 64, 128, 256];
    console.log('\n🪟 Windows ICO oluşturuluyor...');
    
    const icoBuffers = await Promise.all(
      icoSizes.map(async (size) => {
        const buffer = await image
          .clone()
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toBuffer();
        
        console.log(`   ✓ ${size}x${size} boyutu hazırlandı`);
        return { size, buffer };
      })
    );

    // ICO dosyasını oluştur
    const icoFile = await toIco(
      icoBuffers.map(item => item.buffer),
      {
        sizes: icoSizes
      }
    );

    const icoPath = path.join(assetsDir, 'icon.ico');
    fs.writeFileSync(icoPath, icoFile);
    console.log(`   ✅ icon.ico oluşturuldu (${(icoFile.length / 1024).toFixed(2)} KB)`);

    // macOS ICNS için boyutlar (iconutil gerektirir, manuel oluşturma)
    const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
    console.log('\n🍎 macOS ICNS için PNG boyutları oluşturuluyor...');
    
    // ICNS oluşturmak için geçici klasör
    const icnsDir = path.join(assetsDir, 'icon.iconset');
    if (fs.existsSync(icnsDir)) {
      fs.rmSync(icnsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(icnsDir, { recursive: true });

    // ICNS için gerekli PNG boyutlarını oluştur
    const icnsMappings = [
      { size: 16, name: 'icon_16x16.png' },
      { size: 32, name: 'icon_16x16@2x.png' },
      { size: 32, name: 'icon_32x32.png' },
      { size: 64, name: 'icon_32x32@2x.png' },
      { size: 128, name: 'icon_128x128.png' },
      { size: 256, name: 'icon_128x128@2x.png' },
      { size: 256, name: 'icon_256x256.png' },
      { size: 512, name: 'icon_256x256@2x.png' },
      { size: 512, name: 'icon_512x512.png' },
      { size: 1024, name: 'icon_512x512@2x.png' }
    ];

    for (const mapping of icnsMappings) {
      await image
        .clone()
        .resize(mapping.size, mapping.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(path.join(icnsDir, mapping.name));
    }

    console.log(`   ✅ ICNS için ${icnsMappings.length} boyut hazırlandı`);
    console.log(`   💡 macOS'ta ICNS oluşturmak için: iconutil -c icns ${icnsDir}`);

    // Linux için 256x256 PNG (zaten var ama kontrol edelim)
    console.log('\n🐧 Linux PNG kontrolü...');
    const linuxIconPath = path.join(assetsDir, 'icon-256.png');
    await image
      .clone()
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(linuxIconPath);
    console.log(`   ✅ icon-256.png oluşturuldu`);

    // Özet
    console.log('\n' + '='.repeat(50));
    console.log('✅ Tüm icon formatları başarıyla oluşturuldu!');
    console.log('='.repeat(50));
    console.log('\n📁 Oluşturulan dosyalar:');
    console.log(`   • ${path.relative(projectRoot, icoPath)}`);
    console.log(`   • ${path.relative(projectRoot, linuxIconPath)}`);
    console.log(`   • ${path.relative(projectRoot, icnsDir)}/ (ICNS için hazır)`);
    console.log('\n💡 Not: macOS ICNS dosyası oluşturmak için macOS sisteminde iconutil kullanın.');
    console.log('   Windows/Linux\'ta sadece .iconset klasörü hazırlanır.\n');

  } catch (error) {
    console.error('\n❌ HATA:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Script'i çalıştır
generateIcons().catch((error) => {
  console.error('❌ Beklenmeyen hata:', error);
  process.exit(1);
});

