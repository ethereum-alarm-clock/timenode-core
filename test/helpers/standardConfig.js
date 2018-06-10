const Ganache = require('ganache-core');
const Web3 = require('web3');
const loki = require('lokijs');

const provider = new Web3.providers.HttpProvider('http://localhost:8545');
const web3 = new Web3(provider);

const eac = require('eac.js-lib')(web3);

const { Config, StatsDB } = require('../../index');
const MockLogger = require('./MockLogger');

const configParams = {
    autostart: true,
    eac,
    economicStategy: {},
    factory: '0x0',
    logger: new MockLogger(),
    ms: 4000,
    password: 'standardConfig',
    provider,
    scanSpread: 0,
    statsDb: new StatsDB(web3, new loki('stats.json')),
    walletStores: {},
    web3,
}

const standardConfig = () => {
    return new Config(configParams);
}

module.exports = standardConfig;