import * as loki from 'lokijs';
import { Config } from '../../src/index';
import MockLogger from './MockLogger';
import { createWalletKeystore } from './createWallet';
import { providerUrl } from './network';
import BigNumber from 'bignumber.js';

const PRIVATE_KEY = 'fdf2e15fd858d9d81e31baa1fe76de9c7d49af0018a1322aa2b9e493b02afa26';

const mockConfig = (preConfig?: any) => {
  const client = preConfig && preConfig.client ? preConfig.client : undefined;

  const filename = 'wallet.txt';
  const password = 'password123';
  const wallet = [PRIVATE_KEY]; //createWalletKeystore(web3, 1, filename, password);

  return new Config({
    autostart: true,
    client,
    claiming: true,
    economicStrategy: {
      maxDeposit: new BigNumber(0),
      minBalance: new BigNumber(0),
      minProfitability: new BigNumber(0)
    },
    logger: new MockLogger(),
    ms: 4000,
    password,
    providerUrl,
    scanSpread: 0,
    statsDb: new loki('stats.db', {
      autoload: true,
      autosave: true,
      autosaveInterval: 4000
    }),
    walletStores: wallet,
    walletStoresAsPrivateKeys: true
  });
};

export { mockConfig, PRIVATE_KEY };
