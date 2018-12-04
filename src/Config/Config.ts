// tslint:disable-next-line:no-reference
/// <reference path="../global.d.ts" />

import { EAC, Util, GasPriceUtil } from '@ethereum-alarm-clock/lib';
import Cache from '../Cache';
import { Wallet } from '../Wallet';
import { IConfigParams } from './IConfigParams';
import { IEconomicStrategy, EconomicStrategyManager } from '../EconomicStrategy';
import { ILogger, DefaultLogger } from '../Logger';
import { StatsDB } from '../Stats';
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
import { TxPool } from '../TxPool';
import Web3 = require('web3');

export default class Config implements IConfigParams {
  public static readonly DEFAULT_ECONOMIC_STRATEGY: IEconomicStrategy = {
    maxDeposit: new BigNumber(1000000000000000000),
    minBalance: new BigNumber(0),
    minProfitability: new BigNumber(0),
    maxGasSubsidy: 100,
    minClaimWindow: 30,
    minClaimWindowBlock: 2,
    minExecutionWindow: 150,
    minExecutionWindowBlock: 10,
    usingSmartGasEstimation: false
  };

  public activeProviderUrl: string;
  public autostart: boolean;
  public cache: Cache<ICachedTxDetails>;
  public claiming: boolean;
  public eac: EAC;
  public economicStrategy?: IEconomicStrategy;
  public economicStrategyManager: IEconomicStrategyManager;
  public gasPriceUtil: GasPriceUtil;
  public ledger: Ledger;
  public logger?: ILogger;
  public maxRetries?: number;
  public ms: number;
  public pending: Pending;
  public providerUrls: string[];
  public scanSpread: any;
  public statsDb: StatsDB;
  public statsDbLoaded: Promise<boolean>;
  public transactionReceiptAwaiter: ITransactionReceiptAwaiter;
  public txPool: TxPool;
  public util: Util;
  public wallet: Wallet;
  public web3: Web3;
  public walletStoresAsPrivateKeys: boolean;

  // tslint:disable-next-line:cognitive-complexity
  constructor(params: IConfigParams) {
    if (!params.providerUrls.length) {
      throw new Error('Must pass at least 1 providerUrl to the config object.');
    }

    this.web3 = Util.getWeb3FromProviderUrl(params.providerUrls[0]);
    this.activeProviderUrl = params.providerUrls[0];
    this.util = new Util(this.web3);
    this.gasPriceUtil = new GasPriceUtil(this.web3);
    this.eac = new EAC(this.web3);
    this.providerUrls = params.providerUrls;

    this.economicStrategy = params.economicStrategy || Config.DEFAULT_ECONOMIC_STRATEGY;

    this.autostart = params.autostart !== undefined ? params.autostart : true;
    this.claiming = params.claiming || false;
    this.maxRetries = params.maxRetries || 30;
    this.ms = params.ms || 4000;
    this.scanSpread = params.scanSpread || 50;
    this.walletStoresAsPrivateKeys = params.walletStoresAsPrivateKeys || false;
    this.logger = params.logger || new DefaultLogger();
    this.txPool = new TxPool(this.web3, this.util, this.logger);
    this.transactionReceiptAwaiter = new TransactionReceiptAwaiter(this.util);
    this.cache = new Cache(this.logger);
    this.economicStrategyManager = new EconomicStrategyManager(
      this.economicStrategy,
      this.gasPriceUtil,
      this.cache,
      this.eac,
      this.util,
      this.logger
    );
    this.pending = new Pending(this.gasPriceUtil, this.txPool);

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
