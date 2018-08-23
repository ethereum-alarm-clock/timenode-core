import * as loki from 'lokijs';
import { Config } from '../../src/index';
// import { createWalletKeystore } from './createWallet';
import { providerUrl } from './network';
import { DefaultLogger } from '../../src/Logger';
import { mockTxRequest } from './MockTxRequest';

const PRIVATE_KEY = 'fdf2e15fd858d9d81e31baa1fe76de9c7d49af0018a1322aa2b9e493b02afa26';

const mockConfig = async () => {
  const password = 'password123';
  const wallet = [PRIVATE_KEY]; //createWalletKeystore(web3, 1, filename, password);
  const config = new Config({
    autostart: true,
    claiming: true,
    logger: new DefaultLogger(),
    ms: 4000,
    password,
    providerUrl,
    scanSpread: 0,
    statsDb: new loki('stats.db'),
    walletStores: wallet,
    walletStoresAsPrivateKeys: true
  });

  const oldEstimateGas = config.util.estimateGas;

  config.util.estimateGas = async (opts: any) => {
    const mockTx = await mockTxRequest(config.web3);
    if (opts.to === mockTx.address) {
      return 21000;
    }
    console.log(opts);
    return await oldEstimateGas(opts);
  };

  await config.statsDbLoaded;
  return config;
};

export { mockConfig, PRIVATE_KEY };
