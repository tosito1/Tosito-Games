const fs = require('fs');
const path = require('path');

function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied ${src} to ${dest}`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log(`Copied directory ${src} to ${dest}`);
}

// 1. Sync index.html (templates to public)
const templateIndex = path.join(__dirname, '..', 'templates', 'index.html');
const publicIndex = path.join(__dirname, '..', 'public', 'index.html');
if (fs.existsSync(templateIndex)) {
  copyFile(templateIndex, publicIndex);
}

// 2. Sync any specific api data needed for static hosting
const apiSrc = path.join(__dirname, '..', 'templates', 'api');
const apiDest = path.join(__dirname, '..', 'public', 'api');
if (fs.existsSync(apiSrc)) {
  copyDir(apiSrc, apiDest);
}

console.log('Build complete!');
