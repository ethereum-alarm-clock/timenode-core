import Cache from '../Cache';
import Wallet from '../Wallet';
import { IConfigParams } from './IConfigParams';
import { IEconomicStrategy } from '../EconomicStrategy';
import { ILogger, DefaultLogger } from '../Logger';
import { StatsDB } from '../Stats';
import W3Util from '../Util';

export default class Config implements IConfigParams {
  public autostart: boolean;
  public cache: Cache;
  public claiming: boolean;
  public client?: string;
  public eac: any;
  public economicStrategy?: IEconomicStrategy;
  public factory: any;
  public logger?: ILogger;
  public ms: any;
  public provider: any;
  public scanSpread: any;
  public statsDb: StatsDB;
  public util: any;
  public wallet: Wallet;
  public web3: any;
  public walletStoresAsPrivateKeys: boolean;

  constructor(params: IConfigParams) {
    this.autostart = params.autostart || true;
    this.claiming = true;
    this.ms = params.ms || 4000;
    this.scanSpread = params.scanSpread || 50;
    this.walletStoresAsPrivateKeys = params.walletStoresAsPrivateKeys;

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

    if (params.walletStores && params.walletStores.length && params.walletStores.length > 0) {
      this.wallet = new Wallet(this.web3, this.logger);

      params.walletStores = params.walletStores.map((store: object | string) => {
        if (typeof store === 'object') {
          return JSON.stringify(store);
        }

        return store;
      });

      if (this.walletStoresAsPrivateKeys) {
        this.wallet.loadPrivateKeys(params.walletStores);
      } else {
        this.wallet.decrypt(params.walletStores, params.password);
      }
    } else {
      this.wallet = null;
    }

    this.statsDb = params.statsDb;
    this.util = new W3Util(this.web3);
    this.economicStrategy = params.economicStrategy;
  }
}
