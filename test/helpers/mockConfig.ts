import * as Web3 from 'web3';
import * as loki from 'lokijs';
import { Config, StatsDB } from '../../src/index';
import MockLogger from './MockLogger';
import { createWalletKeystore } from './createWallet';
import { providerUrl } from './network';
import BigNumber from 'bignumber.js';

const mockConfig = () => {
  const provider = new Web3.providers.HttpProvider(providerUrl);
  const web3 = new Web3(provider);

  const eac = require('eac.js-lib')(web3);

  const filename = 'wallet.txt';
  const password = 'password123';
  const wallet = ['fdf2e15fd858d9d81e31baa1fe76de9c7d49af0018a1322aa2b9e493b02afa26']; //createWalletKeystore(web3, 1, filename, password);

  return new Config({
    autostart: true,
    eac,
    economicStrategy: {
      maxDeposit: new BigNumber(0),
      minBalance: new BigNumber(0),
      minProfitability: new BigNumber(0),
    },
    factory: '0x0',
    logger: new MockLogger(),
    ms: 4000,
    password,
    provider,
    scanSpread: 0,
    statsDb: new StatsDB(web3, new loki('stats.db', {
      autoload: true,
      autosave: true,
      autosaveInterval: 4000,
    })),
    walletStores: wallet,
    walletStoresAsPrivateKeys: true,
    web3
  });
}

export { mockConfig };