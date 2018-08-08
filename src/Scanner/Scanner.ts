/* eslint no-await-in-loop: 'off' */
import Config from '../Config';

declare const clearInterval: any;
declare const setInterval: any;

import { IBlock, IntervalId, ITxRequest } from '../Types';

import { Bucket, IBucketPair, IBuckets, BucketSize } from '../Buckets';
import W3Util from '../Util';
import { CacheStates } from '../Enum';

export default class {
  public config: Config;
  public util: W3Util;
  public scanning: boolean;
  public router: any;
  public requestFactory: Promise<any>;

  // Child Scanners, tracked by the ID of their interval
  public cacheScanner: IntervalId;
  public chainScanner: IntervalId;

  public buckets: IBuckets = {
    currentBuckets: {
      blockBucket: -1,
      timestampBucket: -1
    },
    nextBuckets: {
      blockBucket: -1,
      timestampBucket: -1
    }
  };
  public eventWatchers: {} = {};

  /**
   * Creates a new Scanner instance. The scanner serves as the top level
   * entry point for the EAC-JS TimeNode. You still need to call the
   * `start()` function before the TimeNode becomes active.
   * @param {number} ms Milliseconds of the scan interval.
   * @param {Config} config The TimeNode Config object.
   */
  constructor(config: Config, router: any) {
    this.config = config;
    this.util = config.util;
    this.scanning = false;
    this.router = router;
    this.requestFactory = config.eac.requestFactory();
  }

  public async runAndSetInterval(fn: () => void, interval: number): Promise<IntervalId> {
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

  public async start(): Promise<boolean> {
    if (!this.config.clientSet()) {
      await this.config.awaitClientSet();
    }

    if (await this.util.isWatchingEnabled()) {
      // Watching is enabled! start watching the chain.
      this.config.logger.info('Watching ENABLED');
      this.chainScanner = await this.runAndSetInterval(() => this.watchBlockchain(), 5 * 60 * 1000);
    } else {
      // Watchin disabled. We use old-school methods.
      this.config.logger.info('Watching DISABLED');
      this.config.logger.info('-Initiating Backup Scanner-');
      this.chainScanner = await this.runAndSetInterval(
        () => this.backupScanBlockchain(),
        this.config.ms
      );
    }

    // Create the interval for processing the transaction requests in cache.
    this.cacheScanner = await this.runAndSetInterval(() => this.scanCache(), this.config.ms);

    // Mark that we've started.
    // this.config.logger.info('Scanner STARTED');
    this.scanning = true;
    return this.scanning;
  }

  public stop(): boolean {
    if (this.scanning) {
      // Clear scanning intervals.
      clearInterval(this.cacheScanner);
      clearInterval(this.chainScanner);

      // Mark that we've stopped.
      this.config.logger.info('Scanner STOPPED');
      this.scanning = false;
    }

    return this.scanning;
  }

  /**
   * Performs four checks:
   *  - The TxRequest is before claim window.
   *  - The TxRequest is in claim window.
   *  - The TxRequest is in freeze period.
   *  - The TxRequest is in execution window.
   * These are the four conditions in which the TxRequest is upcoming,
   * and should be stored in a TimeNodes cache.
   * @param txRequest Transaction Request Object
   */
  public async isUpcoming(txRequest: any): Promise<boolean> {
    return (
      (await txRequest.beforeClaimWindow()) ||
      (await txRequest.inClaimWindow()) ||
      (await txRequest.inFreezePeriod()) ||
      (await txRequest.inExecutionWindow())
    );
  }

  //TODO move this to requestFactory instance
  public async getCurrentBuckets(latest: IBlock): Promise<IBucketPair> {
    const reqFactory = await this.requestFactory;

    return {
      blockBucket: reqFactory.calcBucket(latest.number, 1),
      timestampBucket: reqFactory.calcBucket(latest.timestamp, 2)
    };
  }

  public async getNextBuckets(latest: IBlock): Promise<IBucketPair> {
    const reqFactory = await this.requestFactory;
    const nextBlockInterval = latest.number + BucketSize.block;
    const nextTsInterval = latest.timestamp + BucketSize.timestamp;

    return {
      blockBucket: reqFactory.calcBucket(nextBlockInterval, 1),
      timestampBucket: reqFactory.calcBucket(nextTsInterval, 2)
    };
  }

  public async getBuckets(): Promise<IBuckets> {
    const latest: IBlock = await this.util.getBlock('latest');
    return {
      currentBuckets: await this.getCurrentBuckets(latest),
      nextBuckets: await this.getNextBuckets(latest)
    };
  }

  public handleRequest(request: any): void {
    if (!this.isValid(request.address)) {
      throw new Error(`[${request.address}] NOT VALID`);
    }

    this.config.logger.info(`[${request.address}] Discovered`);
    if (!this.config.cache.has(request.address)) {
      this.store(request);

      this.config.statsDb.incrementDiscovered(this.config.wallet.getAddresses()[0]);
    }
  }

  public async backupScanBlockchain(): Promise<void> {
    // TODO only init reqFactory once, so check here with a function before calling again
    const reqFactory = await this.requestFactory;
    const { currentBuckets, nextBuckets } = await this.getBuckets();
    const handleRequest = this.handleRequest.bind(this);

    // TODO: extract this out
    (await reqFactory.getRequestsByBucket(currentBuckets.blockBucket)).map(handleRequest);
    (await reqFactory.getRequestsByBucket(currentBuckets.timestampBucket)).map(handleRequest);
    (await reqFactory.getRequestsByBucket(nextBuckets.blockBucket)).map(handleRequest);
    (await reqFactory.getRequestsByBucket(nextBuckets.timestampBucket)).map(handleRequest);
  }

  public async stopWatcher(bucket: Bucket) {
    try {
      const watcher = this.eventWatchers[bucket];
      if (watcher !== undefined) {
        const reqFactory = await this.requestFactory;
        await reqFactory.stopWatch(watcher);
        delete this.eventWatchers[bucket];

        this.config.logger.debug(`Buckets: Watcher for bucket=${bucket} has been stopped`);
      }
    } catch (err) {
      this.config.logger.error(`Buckets: Stopping bucket=${bucket} watching failed!`);
    }
  }

  public async watchRequestsByBucket(bucket: Bucket, previousBucket: Bucket) {
    const reqFactory = await this.requestFactory;
    const handleRequest = this.handleRequest.bind(this);
    let currentBucket = previousBucket;

    if (bucket !== previousBucket) {
      await this.stopWatcher(previousBucket);

      try {
        const watcher = await reqFactory.watchRequestsByBucket(bucket, handleRequest);
        this.eventWatchers[bucket] = watcher;
        currentBucket = bucket;

        this.config.logger.debug(`Buckets: Watcher for bucket=${bucket} has been started`);
      } catch (err) {
        this.config.logger.error(`Buckets: Starting bucket=${bucket} watching failed!`);
      }
    }

    return currentBucket;
  }

  public async watchBlockchain(): Promise<void> {
    const buckets = await this.getBuckets();

    this.config.logger.debug(`Buckets: before current buckets=${JSON.stringify(this.buckets)}`);

    // Start watching the current buckets right away.
    this.buckets.currentBuckets.blockBucket = await this.watchRequestsByBucket(
      buckets.currentBuckets.blockBucket,
      this.buckets.currentBuckets.blockBucket
    );
    this.buckets.nextBuckets.blockBucket = await this.watchRequestsByBucket(
      buckets.nextBuckets.blockBucket,
      this.buckets.nextBuckets.blockBucket
    );

    this.buckets.currentBuckets.timestampBucket = await this.watchRequestsByBucket(
      buckets.currentBuckets.timestampBucket,
      this.buckets.currentBuckets.timestampBucket
    );
    this.buckets.nextBuckets.timestampBucket = await this.watchRequestsByBucket(
      buckets.nextBuckets.timestampBucket,
      this.buckets.nextBuckets.timestampBucket
    );

    this.config.logger.debug(`Buckets: after current buckets=${JSON.stringify(this.buckets)}`);
  }

  public isValid(requestAddress: string): boolean {
    if (requestAddress === this.config.eac.Constants.NULL_ADDRESS) {
      this.config.logger.debug('Warning.. Transaction Request with NULL_ADDRESS found.');
      return false;
    } else if (!this.config.eac.Util.checkValidAddress(requestAddress)) {
      // This should, conceivably, never happen unless there is a bug in eac.js-lib.
      throw new Error(
        `[${requestAddress}] Received invalid response from Request Tracker - CRITICAL BUG`
      );
    }
    return true;
  }

  // TODO meaningful return value
  public async scanCache(): Promise<CacheStates> {
    if (this.config.cache.isEmpty()) {
      return CacheStates.EMPTY; // 1 = cache is empty
    }

    // Get all transaction requests stored in cache and turn them into TransactionRequest objects.
    const allTxRequests = this.config.cache
      .stored()
      .filter((address: string) => {
        const cached = this.config.cache.get(address);

        return cached && cached.windowStart.greaterThan(0);
      })
      .map((address: string) => this.config.eac.transactionRequest(address));

    // Get fresh data on our transaction requests and route them into appropriate action.
    const requests = await Promise.all(allTxRequests);
    requests.forEach(async (txRequest: ITxRequest) => {
      await txRequest.refreshData();

      this.router.route(txRequest);
    });

    return CacheStates.REFRESHED; //0 = cache loaded successfully
  }

  public store(request: any) {
    this.config.cache.set(request.address, {
      claimedBy: null,
      wasCalled: false,
      windowStart: request.params[7]
    });
  }
}
