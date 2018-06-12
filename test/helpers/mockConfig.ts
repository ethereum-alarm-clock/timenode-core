import * as Web3 from 'web3';
import * as loki from 'lokijs';
import { Config, StatsDB } from '../../src/index';
import MockLogger from './MockLogger';
import { createWalletKeystore } from './createWallet';
import { providerUrl } from './network';

const mockConfig = () => {
    const provider = new Web3.providers.HttpProvider(providerUrl);
    const web3 = new Web3(provider);
    
    const eac = require('eac.js-lib')(web3);

    const filename = 'wallet.txt';
    const password = 'password123';
    const wallet = createWalletKeystore(web3, 1, filename, password);

    return new Config({
        autostart: true,
        eac,
        economicStrategy: {},
        factory: '0x0',
        logger: new MockLogger(),
        ms: 4000,
        password,
        provider,
        scanSpread: 0,
        statsDb: new StatsDB(web3, new loki('stats.json')),
        walletStores: wallet,
        web3,
    });
}

export { mockConfig };