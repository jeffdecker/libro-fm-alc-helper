const fs = require('fs');
const path = require('path');

// 1. Get the version from package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageData.version;

// 2. Open manifest.json
const manifestPath = path.join(__dirname, '../manifest.json');
const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// 3. Update the version in manifest
if (manifestData.version !== version) {
  manifestData.version = version;
  
  // 4. Write the changes back to manifest.json beautifully formatted
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2) + '\n');
  console.log(`✅ Synced manifest.json to version ${version}`);
} else {
  console.log(`ℹ️ manifest.json is already up to date (${version})`);
}
