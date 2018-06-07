type Version = string;

declare const require;

const version: Version = require('../package.json').version;

export default version;
