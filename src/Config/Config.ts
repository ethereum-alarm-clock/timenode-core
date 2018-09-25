// tslint:disable-next-line:no-reference
/// <reference path="../global.d.ts" />

import * as EAC from 'eac.js-lib';
import Cache from '../Cache';
import { Wallet } from '../Wallet';
import { IConfigParams } from './IConfigParams';
import { IEconomicStrategy, EconomicStrategyManager } from '../EconomicStrategy';
import { ILogger, DefaultLogger } from '../Logger';
import { StatsDB } from '../Stats';
import TxPool from '../TxPool';
import W3Util from '../Util';
import { ICachedTxDetails } from '../Cache/Cache';
import BigNumber from 'bignumber.js';
import {
  ITransactionReceiptAwaiter,
  TransactionReceiptAwaiter
} from '../Wallet/TransactionReceiptAwaiter';
import { IEconomicStrategyManager } from '../EconomicStrategy/EconomicStrategyManager';
import { Ledger } from '../Actions/Ledger';
import { Pending } from '../Actions/Pending';
import { AccountState } from '../Wallet/AccountState';

export default class Config implements IConfigParams {
  public static readonly DEFAULT_ECONOMIC_STRATEGY: IEconomicStrategy = {
    maxDeposit: new BigNumber(1000000000000000000),
    minBalance: new BigNumber(0),
    minProfitability: new BigNumber(0),
    maxGasSubsidy: 100
  };

  public activeProviderUrl: string;
  public autostart: boolean;
  public cache: Cache<ICachedTxDetails>;
  public claiming: boolean;
  public eac: any;
  public economicStrategy?: IEconomicStrategy;
  public logger?: ILogger;
  public maxRetries?: number;
  public ms: any;
  public providerUrls: string[];
  public scanSpread: any;
  public statsDb: StatsDB;
  public statsDbLoaded: Promise<boolean>;
  public txPool: TxPool;
  public util: W3Util;
  public wallet: Wallet;
  public web3: any;
  public walletStoresAsPrivateKeys: boolean;
  public economicStrategyManager: IEconomicStrategyManager;
  public transactionReceiptAwaiter: ITransactionReceiptAwaiter;
  public ledger: Ledger;
  public pending: Pending;

  // tslint:disable-next-line:cognitive-complexity
  constructor(params: IConfigParams) {
    if (params.providerUrls.length) {
      this.web3 = W3Util.getWeb3FromProviderUrl(params.providerUrls[0]);
      this.activeProviderUrl = params.providerUrls[0];
      this.util = new W3Util(this.web3);
      this.eac = EAC(this.web3);
      this.providerUrls = params.providerUrls;
    } else {
      throw new Error('Must pass at least 1 providerUrl to the config object.');
    }

    this.economicStrategy = params.economicStrategy || {
      maxDeposit: Config.DEFAULT_ECONOMIC_STRATEGY.maxDeposit,
      minBalance: Config.DEFAULT_ECONOMIC_STRATEGY.minBalance,
      minProfitability: Config.DEFAULT_ECONOMIC_STRATEGY.minProfitability,
      maxGasSubsidy: Config.DEFAULT_ECONOMIC_STRATEGY.maxGasSubsidy
    };

    this.autostart = params.autostart !== undefined ? params.autostart : true;
    this.claiming = params.claiming || false;
    this.maxRetries = params.maxRetries || 30;
    this.ms = params.ms || 4000;
    this.scanSpread = params.scanSpread || 50;
    this.walletStoresAsPrivateKeys = params.walletStoresAsPrivateKeys || false;
    this.logger = params.logger || new DefaultLogger();
    this.txPool = new TxPool(this);
    this.transactionReceiptAwaiter = new TransactionReceiptAwaiter(this.util);
    this.cache = new Cache(this.logger);
    this.economicStrategyManager = new EconomicStrategyManager(
      this.economicStrategy,
      this.util,
      this.cache,
      this.eac,
      this.logger
    );
    this.pending = new Pending(this.util, this.txPool, this.logger);

    if (params.walletStores && params.walletStores.length && params.walletStores.length > 0) {
      this.wallet = new Wallet(
        this.transactionReceiptAwaiter,
        this.util,
        new AccountState(),
        this.logger
      );

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

    this.statsDb = params.statsDb ? new StatsDB(params.statsDb) : null;
    if (this.statsDb) {
      this.statsDbLoaded = this.statsDb.init();
    }

    this.ledger = new Ledger(this.statsDb);
  }
}
