import Cache from '../Cache';
import * as EAC from 'eac.js-lib';
import { Wallet } from '../Wallet';
import { IConfigParams } from './IConfigParams';
import { IEconomicStrategy } from '../EconomicStrategy';
import { ILogger, DefaultLogger } from '../Logger';
import { StatsDB } from '../Stats';
import W3Util from '../Util';
import { ICachedTxDetails } from '../Cache/Cache';
import { getWeb3FromProviderUrl } from './helpers';
import BigNumber from 'bignumber.js';

declare const require: any;
declare const setTimeout: any;

export default class Config implements IConfigParams {
  public static readonly DEFAULT_ECONOMIC_STRATEGY: any = {
    maxDeposit: 0,
    minBalance: 0,
    minProfitability: 0,
    maxGasSubsidy: 100
  };

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
      this.eac = EAC(this.web3);
    } else {
      throw new Error('Please set the providerUrl in the config object.');
    }

    this.economicStrategy =
      params.economicStrategy || this._economicStrategyToBN(Config.DEFAULT_ECONOMIC_STRATEGY);

    this.autostart = params.autostart !== undefined ? params.autostart : true;
    this.claiming = params.claiming || false;
    this.ms = params.ms || 4000;
    this.scanSpread = params.scanSpread || 50;
    this.walletStoresAsPrivateKeys = params.walletStoresAsPrivateKeys || false;
    this.logger = params.logger || new DefaultLogger();

    if (!params.disableDetection) {
      this.getConnectedClient();
    }

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
  }

  public clientSet(): boolean {
    return typeof this.client === 'string';
  }

  public async awaitClientSet(): Promise<any> {
    if (this.clientSet()) {
      return true;
    } else {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(this.awaitClientSet());
        }, 100);
      });
    }
  }

  public async getConnectedClient(): Promise<any> {
    return new Promise(async (resolve, reject) => {
      if (!this.web3) {
        reject();
      }
      try {
        const method = 'txpool_content';
        await this.web3.currentProvider.sendAsync(
          {
            jsonrpc: '2.0',
            method,
            params: [],
            id: 0x07a
          },
          async (err: Error, res: any) => {
            if (!err && !res.error && !this.clientSet()) {
              this.client = 'geth';
            }
            resolve();
          }
        );
      } catch (e) {
        this.logger.error(e.message);
        resolve();
      }
    })
      .then(async () => {
        if (this.clientSet()) {
          return;
        }
        return new Promise(async (resolve, reject) => {
          try {
            const method = 'parity_pendingTransactions';
            await this.web3.currentProvider.sendAsync(
              {
                jsonrpc: '2.0',
                method,
                params: [],
                id: 0x0a7
              },
              async (err: Error, res: any) => {
                if (!err && !res.error && !this.clientSet()) {
                  this.client = 'parity';
                }
                resolve();
              }
            );
          } catch (e) {
            this.logger.error(e.message);
            resolve();
          }
        });
      })
      .then(() => {
        if (!this.clientSet()) {
          this.client = 'unknown';
        }
        this.logger.debug(`Client: ${this.client.toUpperCase()}`);
        return;
      })
      .catch(() => {
        this.client = 'none';
        this.logger.error(`Client: ${this.client.toUpperCase()}`);
      });
  }

  private _economicStrategyToBN(economicStrategy: IEconomicStrategy) {
    return {
      maxDeposit: new BigNumber(economicStrategy.maxDeposit),
      minBalance: new BigNumber(economicStrategy.minBalance),
      minProfitability: new BigNumber(economicStrategy.minProfitability),
      maxGasSubsidy: economicStrategy.maxGasSubsidy
    };
  }
}
