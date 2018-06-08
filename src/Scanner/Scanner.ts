/* eslint no-await-in-loop: 'off' */
declare const require;

declare const console;

import Config from '../Config/index';

declare const clearInterval;
declare const setInterval;

import { IBlock, IntervalId, ITxRequest } from '../Types/index';

import { Bucket, IBucketPair, IBuckets, BucketSize } from '../Buckets/index';

export default class {
  config: Config;
  scanning: boolean;
  router: any;

  // Child Scanners, tracked by the ID of their interval
  cacheScanner: IntervalId;
  chainScanner: IntervalId;

  /**
   * Creates a new Scanner instance. The scanner serves as the top level
   * entry point for the EAC-JS TimeNode. You still need to call the
   * `start()` function before the TimeNode becomes active.
   * @param {number} ms Milliseconds of the scan interval.
   * @param {Config} config The TimeNode Config object.
   */
  constructor(config: Config, router: any) {
    this.config = config;
    this.scanning = false;
    this.router = router;
  }

  async start(): Promise<boolean> {
    // Create the interval for processing the transaction requests in cache.
    this.cacheScanner = setInterval(() => {
      this.scanCache().catch((err) => this.config.logger.error(err));
    }, this.config.ms);

    // TODO: extract this to a utils file perhaps
    //
    // Helper function to determine if we're on a provider which allows
    // us to use the `eth_getFilerLogs` method, and thereby are allowed
    // to watch events.
    const watchingEnabled = await new Promise<boolean>((resolve) => {
      this.config.web3.currentProvider.sendAsync(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getFilterLogs',
          params: [],
        },
        (err) => {
          if (err !== null) {
            resolve(false);
          }
          resolve(true);
        }
      );
    });

    if (watchingEnabled) {
      // Watching is enabled! start watching the chain.
      this.config.logger.info('Watching ENABLED');
      this.chainScanner = await this.watchBlockchain();
    } else {
      // Watchin disabled. We use old-school methods.
      this.config.logger.info('Watching DISABLED');
      this.config.logger.info('-Initiating Backup Scanner-');
      this.chainScanner = await this.backupScanBlockchain();
    }

    // TODO: Do we need to immediately scan the cache?
    this.scanCache().catch((err) => this.config.logger.error(err));

    // Mark that we've started.
    // this.config.logger.info('Scanner STARTED');
    this.scanning = true;
    return this.scanning;
  }

  stop(): boolean {
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
  async isUpcoming(txRequest): Promise<boolean> {
    return (
      (await txRequest.beforeClaimWindow()) ||
      (await txRequest.inClaimWindow()) ||
      (await txRequest.inFreezePeriod()) ||
      (await txRequest.inExecutionWindow())
    );
  }

  //TODO move this to requestFactory instance
  getCurrentBuckets(reqFactory: any, latest: IBlock): IBucketPair {
    return {
      blockBucket: reqFactory.calcBucket(latest),
      timestampBucket: reqFactory.calcBucket(latest),
    };
  }

  getNextBuckets(reqFactory: any, latest: IBlock): IBucketPair {
    const nextBlockInterval = latest.number + BucketSize.block;
    const nextTsInterval = latest.timestamp + BucketSize.timestamp;

    return {
      blockBucket: reqFactory.calcBucket(nextBlockInterval, 1),
      timestampBucket: reqFactory.calcBucket(nextTsInterval, 2),
    };
  }

  async getBuckets(reqFactory: any): Promise<IBuckets> {
    const latest: IBlock = await this.getBlock('latest');
    return {
      currentBuckets: this.getCurrentBuckets(reqFactory, latest),
      nextBuckets: this.getNextBuckets(reqFactory, latest),
    };
  }

  // TODO shouldn't return void
  handleRequest(request: any): void {
    if (!this.isValid(request.address)) return;

    this.config.logger.info(`[${request.address}] Discovered`);
    if (!this.config.cache.has(request.address)) {
      this.store(request);
    }
  }

  async backupScanBlockchain(): Promise<IntervalId> {
    // TODO only init reqFactory once, so check here with a function before calling again
    const reqFactory = await this.config.eac.requestFactory();

    const { currentBuckets, nextBuckets } = await this.getBuckets(reqFactory);

    // TODO: extract this out
    (await reqFactory.getRequestsByBucket(currentBuckets.blockBucket)).map(
      this.handleRequest
    );
    (await reqFactory.getRequestsByBucket(currentBuckets.timestampBucket)).map(
      this.handleRequest
    );
    (await reqFactory.getRequestsByBucket(nextBuckets.blockBucket)).map(
      this.handleRequest
    );
    (await reqFactory.getRequestsByBucket(nextBuckets.timestampBucket)).map(
      this.handleRequest
    );
    //

    // Set a recursive interval to continue this "scan" every ms/1000 seconds.
    return setInterval(() => {
      this.backupScanBlockchain().catch((err) => this.config.logger.error(err));
    }, this.config.ms);
  }

  async watchBlockchain(): Promise<IntervalId> {
    const reqFactory = await this.config.eac.requestFactory();

    const { currentBuckets, nextBuckets } = await this.getBuckets(reqFactory);

    // const handleRequest = this.handleRequest.bind(this);

    const handleRequest = (request: any): void => {
      if (!this.isValid(request.address)) {
        throw new Error(`[${request.address}] NOT VALID`);
      }

      this.config.logger.info(`[${request.address}] Discovered`);
      if (!this.config.cache.has(request.address)) {
        this.store(request);
      }
    };

    // Start watching the current buckets right away.
    reqFactory.watchRequestsByBucket(currentBuckets.blockBucket, handleRequest);
    reqFactory.watchRequestsByBucket(
      currentBuckets.timestampBucket,
      handleRequest
    );
    reqFactory.watchRequestsByBucket(nextBuckets.blockBucket, handleRequest);
    reqFactory.watchRequestsByBucket(
      nextBuckets.timestampBucket,
      handleRequest
    );

    // Needed?
    this.config.logger.info(`Watching STARTED`);

    // Set an timeout for every hour
    return setInterval(() => {
      // We only really need to watch the next buckets, but this is convienence & clarity.
      this.watchBlockchain();
    }, 60 * 60 * 1000);
  }

  isValid(requestAddress: String): boolean {
    if (requestAddress === this.config.eac.Constants.NULL_ADDRESS) {
      this.config.logger.debug(
        'Warning.. Transaction Request with NULL_ADDRESS found.'
      );
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
  async scanCache(): Promise<void> {
    // Check if the cache is empty.
    if (this.config.cache.len() === 0) return;

    // Get all transaction requests stored in cache and turn them into TransactionRequest objects.
    const allTxRequests = this.config.cache
      .stored()
      .filter((address) => this.config.cache.get(address) > 0)
      .map((address) => this.config.eac.transactionRequest(address));

    // Get fresh data on our transaction requests and route them into appropiate action.
    Promise.all(allTxRequests).then((txRequests) => {
      txRequests.forEach((txRequest: ITxRequest) => {
        txRequest
          .refreshData()
          .then(() => this.router.route(txRequest));
      });
    });
  }

  // TODO extract to a utils?
  getBlock(number = 'latest'): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      this.config.web3.eth.getBlock(number, (err, block) => {
        if (!err)
          if (block) resolve(block);
          else reject(`Returned block ${number} is null`);
        else reject(err);
      });
    });
  }

  store(request) {
    this.config.logger.info(`[${request.address}] Inputting to cache`);
    this.config.cache.set(request.address, request.params[7]);
  }
}
