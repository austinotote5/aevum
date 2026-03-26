const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const JS_EXT = '.js';

const shouldSkipDir = (name) => (
  name === 'node_modules'
  || name === '.git'
);

const collectJsFiles = (dirPath, results = []) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      collectJsFiles(fullPath, results);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(JS_EXT)) {
      results.push(fullPath);
    }
  }
  return results;
};

const runSyntaxCheck = (filePath) => {
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    new vm.Script(source, { filename: filePath });
    return { ok: true, output: '' };
  } catch (error) {
    return {
      ok: false,
      output: error?.stack || error?.message || String(error),
    };
  }
};

const files = collectJsFiles(ROOT).sort();
const failed = [];

for (const filePath of files) {
  const result = runSyntaxCheck(filePath);
  if (!result.ok) {
    failed.push({
      filePath,
      output: String(result.output || '').trim(),
    });
  }
}

if (failed.length > 0) {
  console.error(`[lint:server] syntax check failed for ${failed.length} file(s).`);
  failed.forEach((item) => {
    console.error(`\n${item.filePath}\n${item.output}`);
  });
  process.exitCode = 1;
} else {
  console.log(`[lint:server] syntax check passed for ${files.length} file(s).`);
}
