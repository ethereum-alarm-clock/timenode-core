const Config = require('./client/config')
const { Scanner } = require('./client/scanner')
const StatsDB = require('./client/statsdb')
const Wallet = require('./client/wallet')
const version = require('./package.json').version;

module.exports = {
    Config,
    Scanner,
    StatsDB,
    Wallet,
    version
}