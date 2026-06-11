const fs = require('fs');
const path = require('path');

const dirs = [
  'src/services',
  'src/hooks'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created: ${fullPath}`);
  }
});

console.log('Bootstrap completed');
