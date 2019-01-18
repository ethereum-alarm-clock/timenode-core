import { CLAIMED_EVENT, EXECUTED_EVENT } from '../Actions/Helpers';
import { ILogger } from '../Logger';
import TxPoolProcessor from './TxPoolProcessor';
import Web3 = require('web3');
import { Subscribe, Log, Callback } from 'web3/types';
import { Util } from '@ethereum-alarm-clock/lib';
import { ITxPool, ITxPoolTxDetails } from './ITxPool';

const SCAN_INTERVAL = 5000;
const TIME_IN_POOL = 5 * 60 * 1000;

export default class TxPool implements ITxPool {
  public pool: Map<string, ITxPoolTxDetails> = new Map<string, ITxPoolTxDetails>();

  private logger: ILogger;
  private util: Util;
  private web3: Web3;
  private txPoolProcessor: TxPoolProcessor;
  private subs: Map<string, Subscribe<Log>> = new Map<string, Subscribe<Log>>();
  private cleaningTask: NodeJS.Timeout;

  constructor(web3: Web3, util: Util, logger: ILogger) {
    this.web3 = web3;
    this.logger = logger;
    this.util = util;
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

    if (this.cleaningTask) {
      clearInterval(this.cleaningTask);
    }

    this.logger.debug('TxPool STOPPED');
  }

  private async stopTopic(topic: string) {
    const subscription = this.subs.get(topic);
    if (subscription) {
      try {
        await this.util.stopFilter(this.subs[topic] as Subscribe<any>);
        this.subs.delete(topic);
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
    // this is the hack to unlock undocumented toBlock feature used by geth
    const subscribe = this.web3.eth.subscribe as (
      type: 'logs',
      options?: any,
      callback?: Callback<Subscribe<Log>>
    ) => Promise<Subscribe<Log>>;
    const subscription = await subscribe('logs', { toBlock: 'pending', topics: [topic] });

    if (!this.subs[topic]) {
      return;
    }

    subscription.on('data', (data: Log) => {
      if (data.topics && data.topics.indexOf(topic) !== -1) {
        this.txPoolProcessor.process(data, this.pool);
      }
    });

    subscription.on('error', error => {
      this.logger.error(error.toString());
    });

    this.subs.set(topic, subscription);
  }

  private clearMined() {
    this.cleaningTask = setInterval(() => {
      const now = new Date().getTime();
      this.pool.forEach((value, key) => {
        if (now - value.timestamp > TIME_IN_POOL) {
          this.pool.delete(key);
        }
      });
    }, SCAN_INTERVAL);
  }
}
