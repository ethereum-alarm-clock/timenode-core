import * as loki from 'lokijs';
import { Config } from '../../src/index';
import { providerUrl } from './network';
import { DefaultLogger } from '../../src/Logger';

const PRIVATE_KEY = 'fdf2e15fd858d9d81e31baa1fe76de9c7d49af0018a1322aa2b9e493b02afa26';

const mockConfig = async () => {
  // tslint:disable-next-line:no-hardcoded-credentials
  const password = 'password123';
  const wallet = [PRIVATE_KEY];
  const config = new Config({
    autostart: true,
    claiming: true,
    logger: new DefaultLogger(),
    ms: 4000,
    password,
    providerUrls: [providerUrl],
    scanSpread: 0,
    statsDb: new loki('stats.db'),
    walletStores: wallet,
    walletStoresAsPrivateKeys: true
  });

  await config.statsDbLoaded;
  return config;
};

export { mockConfig, PRIVATE_KEY };
