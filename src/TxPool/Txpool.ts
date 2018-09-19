import Config from '../Config';
import { Pool, ITxPoolTxDetails } from './Pool';
import W3Util from '../Util';
import Cache, { ICachedTxDetails } from '../Cache';

const SCAN_INTERVAL = 5000;

export default class TxPool {
  public config: Config;
  public pool: Pool;
  public subs: any = {};

  constructor(config: Config) {
    this.config = config;
    this.pool = new Pool();
  }

  private get cache(): Cache<ICachedTxDetails> {
    return this.config.cache;
  }

  private get logger(): any {
    return this.config.logger;
  }

  private get util(): W3Util {
    return this.config.util;
  }

  public running() {
    return !this.pool.isEmpty() || !!this.subs.pending || !!this.subs.latest;
  }

  public async start() {
    if (this.running()) {
      await this.stop();
    }
    await this.watchPending();
    await this.watchLatest();
    if (this.running()) {
      await this.clearMined();
    }
    this.logger.debug('TxPool started');
  }

  public async stop(): Promise<boolean> {
    if (this.subs.pending) {
      try {
        await this.util.stopFilter(this.subs.pending);
      } catch (e) {
        this.logger.error(e);
      }
    }
    if (this.subs.latest) {
      try {
        await this.util.stopFilter(this.subs.latest);
      } catch (e) {
        this.logger.error(e);
      }
    }
    if (this.subs.mined) {
      clearInterval(this.subs.mined);
    }
    this.pool.wipe();
    this.subs = {};
    this.logger.debug('TxPool STOPPED');

    return true;
  }

  public async watchPending() {
    this.subs.pending = await this.config.web3.eth.filter('pending');
    if (!this.subs.pending) {
      return;
    }
    this.subs.pending.watch(async (err: any, res: any) => {
      if (err) {
        return this.logger.error(err);
      }

      if (!this.pool.preSet(res)) {
        return;
      }

      try {
        const tx: any = await this.util.getTransaction(res);
        if (!tx || tx.blockNumber || tx.blockHash || !this.cache.has(tx.to)) {
          return this.pool.del(res);
        }

        const poolDetails: ITxPoolTxDetails = {
          from: tx.from,
          to: tx.to,
          input: tx.input,
          gasPrice: tx.gasPrice,
          timestamp: new Date().getTime(),
          transactionHash: tx.hash
        };

        if (this.pool.has(res, 'transactionHash')) {
          this.pool.set(res, poolDetails);
        }
      } catch (e) {
        return this.logger.error(e);
      }
    });
  }

  public async watchLatest() {
    this.subs.latest = await this.config.web3.eth.filter({
      fromBlock: 'latest',
      toBlock: 'pending'
    });
    if (this.subs.latest) {
      this.subs.latest.watch(async (err: any, res: any) => {
        if (err) {
          return this.config.logger.error(err);
        }

        this.pool.del(res.transactionHash);
      });
    }
  }

  public async clearMined() {
    this.subs.mined = setInterval(() => {
      this.pool
        .stored()
        .filter((hash: string) => this.pool.get(hash, 'transactionHash').length > 0)
        .forEach(async (hash: string) => {
          try {
            const tx: any = await this.util.getTransaction(hash);
            if (!tx || tx.blockNumber || tx.blockHash) {
              return this.pool.del(hash);
            }
          } catch (e) {
            return this.config.logger.error(e);
          }
        });
    }, SCAN_INTERVAL);
  }
}
