import { expect } from 'chai';

// from https://docs.npmjs.com/files/package.json#dependencies
const nonExactPrefixes = ['~', '^', '>', '>=', '<', '<='];
const packageJSON = require('../../package.json');

describe('package.json', () => {
  it('dependencies should not contain any non-exact versions', () => {
    const deps = Object.keys(packageJSON.dependencies).map(key => packageJSON.dependencies[key]);
    deps.forEach(depVersion => {
      nonExactPrefixes.forEach(badPrefix => {
        expect(depVersion.includes(badPrefix)).to.be.false; // tslint:disable-line no-unused-expression
      });
    });
  });
  it('devDependencies should not contain any non-exact versions', () => {
    const deps = Object.keys(packageJSON.devDependencies).map(
      key => packageJSON.devDependencies[key]
    );
    deps.forEach(depVersion => {
      nonExactPrefixes.forEach(badPrefix => {
        expect(depVersion.includes(badPrefix)).to.be.false; // tslint:disable-line no-unused-expression
      });
    });
  });
});
