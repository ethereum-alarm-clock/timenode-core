import W3Util from '../Util';
import { CLAIMED_EVENT, EXECUTED_EVENT } from '../Actions/Helpers';
import BigNumber from 'bignumber.js';
import { ILogger } from '../Logger';
import { Operation } from '../Types/Operation';

const SCAN_INTERVAL = 5000;
const TIME_IN_POOL = 60 * 1000;

interface IFilterTx {
  address: string;
  blockNumber: number;
  topics: string[];
  transactionHash: string;
  type: string;
}

export interface ITxPoolTxDetails {
  to: string;
  from: string;
  gasPrice: BigNumber;
  timestamp: number;
  transactionHash: string;
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

  constructor(web3: any, util: W3Util, logger: ILogger) {
    this.web3 = web3;
    this.logger = logger;
    this.util = util;
    this.pool = new Map<string, ITxPoolTxDetails>();
  }

  public running() {
    return this.pool.size > 0 || !!this.subs.pending || !!this.subs.latest;
  }

  public async start() {
    if (this.running()) {
      await this.stop();
    }
    await this.watchPending();
    if (this.running()) {
      await this.clearMined();
    }
    this.logger.debug('TxPool started');
  }

  public async stop() {
    if (this.subs.pending) {
      await this.util.stopFilter(this.subs.pending).catch(e => {
        this.logger.error(e);
      });
    }
    if (this.subs.latest) {
      await this.util.stopFilter(this.subs.latest).catch(e => {
        this.logger.error(e);
      });
    }
    if (this.subs.mined) {
      clearInterval(this.subs.mined);
    }
    this.subs = {};
    this.logger.debug('TxPool STOPPED');
  }

  private async watchPending() {
    this.subs.pending = await this.web3.eth.filter({
      fromBlock: 'pending',
      toBlock: 'pending',
      topics: [CLAIMED_EVENT, EXECUTED_EVENT]
    });
    if (!this.subs.pending) {
      return;
    }
    this.subs.pending.watch(async (err: any, res: IFilterTx) => {
      if (err) {
        return this.logger.error(err);
      }

      const { transactionHash, type } = res;
      const operation =
        res.topics.indexOf(CLAIMED_EVENT) > -1 ? Operation.CLAIM : Operation.EXECUTE;

      if (type === 'pending' || !this.pool.has(transactionHash)) {
        await this.setTxPoolDetails(transactionHash, type, operation);
      } else {
        this.pool.get(transactionHash).type = type;
      }
    });
  }

  private async setTxPoolDetails(transactionHash: string, type: string, operation: Operation) {
    try {
      const poolDetails = await this.getTxPoolDetails(transactionHash, type, operation);

      this.pool.set(transactionHash, poolDetails);
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async getTxPoolDetails(
    transactionHash: string,
    type: string,
    operation: Operation
  ): Promise<ITxPoolTxDetails> {
    const tx: any = await this.util.getTransaction(transactionHash);
    return {
      from: tx.from,
      to: tx.to,
      gasPrice: tx.gasPrice,
      timestamp: new Date().getTime(),
      transactionHash,
      type,
      operation
    };
  }

  private async clearMined() {
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
