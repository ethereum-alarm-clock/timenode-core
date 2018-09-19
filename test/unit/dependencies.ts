import { assert } from 'chai';

// from https://docs.npmjs.com/files/package.json#dependencies
const nonExactPrefixes = ['~', '^', '>', '>=', '<', '<='];
const packageJSON = require('../../package.json');

describe('package.json', () => {
  const assertVersion = (version: string) => {
    nonExactPrefixes.forEach(badPrefix => {
      assert.isFalse(version.includes(badPrefix));
    });
  };
  it('dependencies should not contain any non-exact versions', () => {
    const deps = Object.keys(packageJSON.dependencies).map(key => packageJSON.dependencies[key]);
    deps.forEach(assertVersion);
  });
  it('devDependencies should not contain any non-exact versions', () => {
    const deps = Object.keys(packageJSON.devDependencies).map(
      key => packageJSON.devDependencies[key]
    );
    deps.forEach(assertVersion);
  });
});
