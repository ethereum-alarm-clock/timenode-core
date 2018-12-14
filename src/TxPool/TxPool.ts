import { CLAIMED_EVENT, EXECUTED_EVENT } from '../Actions/Helpers';
import BigNumber from 'bignumber.js';
import { ILogger } from '../Logger';
import { Operation } from '../Types/Operation';
import TxPoolProcessor from './TxPoolProcessor';
import Web3 = require('web3');
import { Subscribe, Log } from 'web3/types';
import { Util } from '@ethereum-alarm-clock/lib';

const SCAN_INTERVAL = 5000;
const TIME_IN_POOL = 60 * 1000;

export interface IFilterTx extends Log {
  type: string;
}

export interface ITxPoolTxDetails {
  to: string;
  gasPrice: BigNumber;
  timestamp: number;
  type: string;
  operation: Operation;
}

export interface ITxPool {
  pool: Map<string, ITxPoolTxDetails>;
  running(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export default class TxPool implements ITxPool {
  public pool: Map<string, ITxPoolTxDetails>;
  public subs: any = {};

  private logger: ILogger;
  private util: Util;
  private web3: Web3;
  private txPoolProcessor: TxPoolProcessor;

  constructor(web3: Web3, util: Util, logger: ILogger) {
    this.web3 = web3;
    this.logger = logger;
    this.util = util;
    this.pool = new Map<string, ITxPoolTxDetails>();
    this.txPoolProcessor = new TxPoolProcessor(this.util, this.logger);
  }

  public running() {
    return !!this.subs[EXECUTED_EVENT] && !!this.subs[CLAIMED_EVENT];
  }

  public async start() {
    if (this.running()) {
      await this.stop();
    }

    await this.watchPending();
    this.clearMined();

    this.logger.debug('TxPool started');
  }

  public async stop() {
    await this.stopTopic(CLAIMED_EVENT);
    await this.stopTopic(EXECUTED_EVENT);

    if (this.subs.mined) {
      clearInterval(this.subs.mined);
    }
    this.subs = {};
    this.logger.debug('TxPool STOPPED');
  }

  private async stopTopic(topic: string) {
    if (this.subs[topic]) {
      try {
        await this.util.stopFilter(this.subs[topic] as Subscribe<any>);
        delete this.subs[topic];
      } catch (err) {
        this.logger.error(err);
      }
    }
  }

  private async watchPending() {
    await this.watchTopic(CLAIMED_EVENT);
    await this.watchTopic(EXECUTED_EVENT);
  }

  private async watchTopic(topic: string) {
    this.subs[topic] = await this.web3.eth.subscribe('pendingTransactions');

    if (!this.subs[topic]) {
      return;
    }

    const subscription = this.subs[topic] as Subscribe<any>;
    subscription.on('data', (data: Log) => {
      if (data.topics && data.topics.indexOf(topic) !== -1) {
        const filterTxData = data as IFilterTx;
        filterTxData.type = 'pending';
        this.txPoolProcessor.process(null, filterTxData, this.pool);
      }
    });

    subscription.on('error', error => {
      this.txPoolProcessor.process(error, null, this.pool);
    });
  }

  private clearMined() {
    this.subs.mined = setInterval(() => {
      const now = new Date().getTime();
      this.pool.forEach((value, key) => {
        if (now - value.timestamp > TIME_IN_POOL) {
          this.pool.delete(key);
        }
      });
    }, SCAN_INTERVAL);
  }
}
