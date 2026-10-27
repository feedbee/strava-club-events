const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('@babel/core');
exports.load = async function load(relative, modules, globals = {}) {
  const filename = path.join(__dirname, '..', relative);
  const code = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-typescript'],
  }).code;
  const context = vm.createContext({ console, Date, Error, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, ...globals });
  const module = new vm.SourceTextModule(code, { context });
  await module.link(specifier => {
    if (!Object.hasOwn(modules, specifier)) throw new Error(`Unexpected import ${specifier}`);
    const exports = modules[specifier];
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate(); return module.namespace;
};
