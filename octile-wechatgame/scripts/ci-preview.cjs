/**
 * CI Preview Script - WeChat Mini Game
 * Uploads preview version (体验版) with QR code
 */
const ci = require('miniprogram-ci');
const path = require('path');
const fs = require('fs');

async function main() {
  let privateKeyPath = process.env.WECHAT_PRIVATE_KEY_PATH;
  const privateKeyBase64 = process.env.WECHAT_PRIVATE_KEY_BASE64;
  let tempKeyPath = null;

  try {
    if (privateKeyBase64) {
      const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
      tempKeyPath = path.join(__dirname, '../.tmp-private.key');
      fs.writeFileSync(tempKeyPath, privateKey);
      fs.chmodSync(tempKeyPath, 0o600);
      privateKeyPath = tempKeyPath;
    }

    if (!privateKeyPath) {
      throw new Error('No private key. Set WECHAT_PRIVATE_KEY_BASE64 or WECHAT_PRIVATE_KEY_PATH');
    }

    const project = new ci.Project({
      appid: process.env.WECHAT_APPID,
      type: 'miniGame',
      projectPath: path.resolve(__dirname, '..'),
      privateKeyPath,
      ignores: ['node_modules/**', 'scripts/**', '.git/**'],
    });

    await ci.preview({
      project,
      version: process.env.VERSION || '1.0.0',
      desc: process.env.DESC || `Preview ${new Date().toISOString()}`,
      setting: { es6: true, minify: false },
      qrcodeFormat: 'image',
      qrcodeOutputDest: path.join(__dirname, '../preview-qrcode.jpg'),
    });

    console.log('✅ Preview uploaded successfully');
  } finally {
    if (tempKeyPath && fs.existsSync(tempKeyPath)) {
      fs.unlinkSync(tempKeyPath);
    }
  }
}

main().catch(err => {
  console.error('❌ Preview failed:', err);
  process.exit(1);
});
