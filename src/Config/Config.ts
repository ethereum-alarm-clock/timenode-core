import Cache from '../Cache';
import Wallet from '../Wallet';
import { IConfigParams } from './IConfigParams';
import { IEconomicStrategy } from '../EconomicStrategy';
import { ILogger, DefaultLogger } from '../Logger';
import { StatsDB } from '../Stats';

export default class Config implements IConfigParams {
  autostart: boolean;
  cache: Cache;
  eac: any;
  economicStrategy?: IEconomicStrategy;
  factory: any;
  logger?: ILogger;
  ms: any;
  provider: any;
  scanSpread: any;
  statsDb: StatsDB;
  wallet: any;
  web3: any;

  constructor(params: IConfigParams) {
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
      params.walletStores = params.walletStores.map(
        (store: Object | string) => {
          if (typeof store === 'object') {
            return JSON.stringify(store);
          }

          return store;
        }
      );

      this.wallet = new Wallet(this.web3);
      this.wallet.decrypt(params.walletStores, params.password);
    } else {
      this.wallet = false;
    }

    this.ms = params.ms;

    this.economicStrategy = params.economicStrategy;
  }
}
