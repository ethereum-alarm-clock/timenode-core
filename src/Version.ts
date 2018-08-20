type Version = string;

declare const require: any;

const version: Version = require('../../package.json').version;

export default version;
