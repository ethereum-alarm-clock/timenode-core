const Ganache = require('ganache-core');
const Web3 = require('web3');

const provider = Ganache.provider({
    "gasLimit": 7000000,
    "locked": false,
});

const web3 = new Web3(provider);

const eac = require('eac.js-lib')(web3);

const { Config } = require('../../index');

const configParams = {
    autostart: true,
    eac,
    economicStategy: {},
    factory: '0x0',
    logger: {},
    ms: 4000,
    password: 'standardConfig',
    provider,
    scanSpread: 0,
    walletStores: {},
    web3,
}

const standardConfig = () => {
    return new Config(configParams);
}

module.exports = standardConfig;