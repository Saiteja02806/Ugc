// Next.js Webpack and Turbopack place compiled CSS in different directories.
const fs = require('node:fs');
const path = require('node:path');
module.exports = function compiledBrowserCss(root) {
  const dirs = ['.next/static/chunks', '.next/static/css'].map(dir => path.join(root, dir));
  const css = dirs.filter(dir => fs.existsSync(dir)).flatMap(dir => fs.readdirSync(dir)
    .filter(name => name.endsWith('.css')).map(name => fs.readFileSync(path.join(dir, name), 'utf8'))).join('\n');
  if (!css) throw new Error('Compile the local app before running the browser fixture');
  return css;
};
