import W3Util from '../Util';
import { CLAIMED_EVENT, EXECUTED_EVENT } from '../Actions/Helpers';
import BigNumber from 'bignumber.js';
import { ILogger } from '../Logger';
import { Operation } from '../Types/Operation';
import TxPoolProcessor from './TxPoolProcessor';

const SCAN_INTERVAL = 5000;
const TIME_IN_POOL = 60 * 1000;

export interface IFilterTx {
  address: string;
  blockNumber: number;
  topics: string[];
  transactionHash: string;
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
  private util: W3Util;
  private web3: any;
  private txPoolProcessor: TxPoolProcessor;

  constructor(web3: any, util: W3Util, logger: ILogger) {
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
      await this.util.stopFilter(this.subs[topic]).catch(e => {
        this.logger.error(e);
      });
    }
  }

  private async watchPending() {
    await this.watchTopic(CLAIMED_EVENT);
    await this.watchTopic(EXECUTED_EVENT);
  }

  private async watchTopic(topic: string) {
    this.subs[topic] = await this.web3.eth.filter({
      fromBlock: 'pending',
      toBlock: 'pending',
      topics: [topic]
    });
    if (!this.subs[topic]) {
      return;
    }
    this.subs[topic].watch(async (err: any, res: IFilterTx) =>
      this.txPoolProcessor.process(err, res, this.pool)
    );
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
