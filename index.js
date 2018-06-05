const Config = require('src/config')
const { Scanner } = require('src/scanner')
const StatsDB = require('src/statsdb')
const Wallet = require('src/wallet')
const version = require('./package.json').version;

module.exports = {
    Config,
    Scanner,
    StatsDB,
    Wallet,
    version
}