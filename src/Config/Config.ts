import Cache from '../Cache';
import Wallet from '../Wallet';
import { IConfigParams } from './IConfigParams';
import { IEconomicStrategy } from '../EconomicStrategy';
import { ILogger, DefaultLogger } from '../Logger';
import { StatsDB } from '../Stats';
import W3Util from '../Util';
import { ICachedTxDetails } from '../Cache/Cache';
import { getWeb3FromProviderUrl } from './helpers';

export default class Config implements IConfigParams {
  public autostart: boolean;
  public cache: Cache<ICachedTxDetails>;
  public claiming: boolean;
  public client?: string;
  public eac: any;
  public economicStrategy?: IEconomicStrategy;
  public logger?: ILogger;
  public ms: any;
  public providerUrl: string;
  public scanSpread: any;
  public statsDb: StatsDB;
  public util: any;
  public wallet: Wallet;
  public web3: any;
  public walletStoresAsPrivateKeys: boolean;

  constructor(params: IConfigParams) {
    if (params.providerUrl) {
      this.web3 = getWeb3FromProviderUrl(params.providerUrl);
      this.eac = require('eac.js-lib')(this.web3);
    } else {
      throw new Error('Please set the providerUrl in the config object.');
    }

    this.autostart = params.autostart !== undefined ? params.autostart : true;
    this.claiming = params.claiming || false;
    this.ms = params.ms || 4000;
    this.scanSpread = params.scanSpread || 50;
    this.walletStoresAsPrivateKeys = params.walletStoresAsPrivateKeys || false;
    this.client = params.client || null;
    this.logger = params.logger || new DefaultLogger();

    this.cache = new Cache(this.logger);

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
        if (params.password) {
          this.wallet.decrypt(params.walletStores, params.password);
        } else {
          throw new Error(
            'Unable to unlock the wallet. Please provide a password as a config param'
          );
        }
      }
    } else {
      this.wallet = null;
    }

    this.statsDb = params.statsDb ? new StatsDB(this.web3, params.statsDb) : null;

    this.util = new W3Util(this.web3);
    this.economicStrategy = params.economicStrategy;
  }
}
