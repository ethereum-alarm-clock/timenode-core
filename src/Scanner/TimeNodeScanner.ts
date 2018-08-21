/* eslint no-await-in-loop: 'off' */
import ChainScanner from './ChainScanner';
import Config from '../Config';
import IRouter from '../Router';
import TxPool from '../TxPool';
import { IntervalId } from '../Types';

declare const clearInterval: any;
declare const setInterval: any;

export interface ITimeNodeScanner {
  scanning: boolean;
  txPool: TxPool;

  start(): Promise<boolean>;
  stop(): boolean;
}

export default class TimeNodeScanner extends ChainScanner implements ITimeNodeScanner {
  public scanning: boolean = false;
  public txPool: TxPool;

  /**
   * Creates a new Scanner instance. The scanner serves as the top level
   * entry point for the EAC-JS TimeNode. You still need to call the
   * `start()` function before the TimeNode becomes active.
   * @param {number} ms Milliseconds of the scan interval.
   * @param {Config} config The TimeNode Config object.
   */
  constructor(config: Config, router: IRouter) {
    super(config, router);
    this.txPool = config.txPool;
  }

  public async start(): Promise<boolean> {
    if (!this.config.clientSet()) {
      await this.config.awaitClientSet();
    }
    if (!(await this.util.isWatchingEnabled())) {
      throw new Error('TimeNode is only supported using WebSockets. Use a wss:// provider!');
    }

    await this.txPool.start();

    this.cacheInterval = await this.runAndSetInterval(() => this.scanCache(), this.config.ms);
    this.chainInterval = await this.runAndSetInterval(() => this.watchBlockchain(), 5 * 60 * 1000);

    // Mark that we've started.
    this.config.logger.info('Scanner STARTED');
    this.scanning = true;
    return this.scanning;
  }

  public stop(): boolean {
    if (this.scanning) {
      // Clear scanning intervals.
      clearInterval(this.cacheInterval);
      clearInterval(this.chainInterval);

      this.txPool.stop();

      // Mark that we've stopped.
      this.config.logger.info('Scanner STOPPED');
      this.scanning = false;
    }

    Object.keys(this.buckets).forEach((key: string) => {
      this.stopWatcher(this.buckets[key].blockBucket);
      this.stopWatcher(this.buckets[key].timestampBucket);
    });

    return this.scanning;
  }

  private async runAndSetInterval(fn: () => void, interval: number): Promise<IntervalId> {
    const wrapped = async () => {
      try {
        await fn();
      } catch (e) {
        this.config.logger.error(e);
      }
    };

    await wrapped();
    return setInterval(wrapped, interval);
  }
}
