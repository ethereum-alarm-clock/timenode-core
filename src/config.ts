import Cache from './cache';
import { Logger, DefaultLogger } from './logger';
import Wallet from './wallet';


//TODO remove factory
interface ConfigParams {
  autostart: boolean;
  eac?: any;
  economicStrategy?: EconomicStrategy,
  factory?: any;
  logger?: Logger;
  ms?: any;
  password?: any;
  provider?: any;
  scanSpread?: number | null;
  walletStores?: any;
  web3?: any;
}

interface EconomicStrategy {
  // TODO
}

export default class Config {
  autostart: boolean;
  cache: any;
  eac: any;
  economicStrategy?: EconomicStrategy,
  factory: any;
  logger: Logger;
  ms: any;
  provider: any;
  scanSpread: any;
  wallet: any;
  web3: any;

  constructor(params: ConfigParams) {
    this.autostart = params.autostart || true;
    this.scanSpread = params.scanSpread || 50;

    this.logger = params.logger || new DefaultLogger();

    this.cache = new Cache(this.logger);

    if (params.eac && params.factory && params.provider && params.web3) {
      this.eac = params.eac;
      this.factory = params.factory;
      this.provider = params.provider;
      this.web3 = params.web3;
    } else {
      throw new Error(
        'Passed in Config params are incomplete! Unable to start TimeNode. Quitting..'
      );
    }

    if (
      params.walletStores &&
      params.walletStores.length &&
      params.walletStores.length > 0
    ) {
      params.walletStores = params.walletStores.map((store, idx) => {
        if (typeof store === 'object') {
          return JSON.stringify(store);
        }
      });

      this.wallet = new Wallet(this.web3);
      this.wallet.decrypt(params.walletStores, params.password);
    } else {
      this.wallet = false;
    }
  }
}
