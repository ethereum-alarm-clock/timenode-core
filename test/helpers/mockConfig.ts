import * as Web3 from 'web3';
import * as loki from 'lokijs';
import { Config, StatsDB } from '../../src/index';
import MockLogger from './MockLogger';

const mockConfig = () => {
    const provider = new Web3.providers.HttpProvider('http://localhost:8545/');
    const web3 = new Web3(provider);
    
    const eac = require('eac.js-lib')(web3);

    return new Config({
        autostart: true,
        eac,
        economicStrategy: {},
        factory: '0x0',
        logger: new MockLogger(),
        ms: 4000,
        password: 'standardConfig',
        provider,
        scanSpread: 0,
        statsDb: new StatsDB(web3, new loki('stats.json')),
        walletStores: {},
        web3,
    });
}

export { mockConfig };