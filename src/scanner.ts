/* eslint no-await-in-loop: 'off' */
declare const require;

const clientVersion = require('../package.json').version;
const SCAN_DELAY = 1;

import Config from './config';

declare const clearInterval;
declare const setInterval;

import {
  Block,
  Bucket,
  BucketPair,
  Buckets,
  IntervalID,
  TxRequest,
} from './types';

export default class Scanner {
  config: Config;
  scanning: boolean;
  router: any;

  // Child Scanners, tracked by the ID of their interval
  cacheScanner: IntervalID;
  chainScanner: IntervalID;

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
    this.config.logger.info('Scanner STARTED');
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

  //TODO correctness?
  // getWindowForBlockNumber(blockNumber: number) {
  //   const leftBlockNumber = this.getLeftBlockNumber(blockNumber);
  //   const rightBlockNumber = leftBlockNumber + this.config.scanSpread * 2;

  //   return { leftBlockNumber, rightBlockNumber };
  // }

  // //TODO correctness?
  // getLeftBlockNumber(blockNumber: number): number {
  //   const leftBlock = blockNumber - this.config.scanSpread;
  //   return leftBlock < 0 ? 0 : leftBlock;
  // }

  // //TODO correctness?
  // getRightTimestamp(leftTimestamp, latestTimestamp): number {
  //   return 2 * latestTimestamp - leftTimestamp;
  // }

  //TODO move this to requestFactory instance
  getCurrentBuckets(reqFactory: any, latest: Block): BucketPair {
    return {
      blockBucket: reqFactory.calcBucket(latest),
      timestampBucket: reqFactory.calcBucket(latest),
    };
  }

  getNextBuckets(reqFactory: any, latest: Block): BucketPair {
    // TODO extract to Constants
    const blockBucketSize = 240;
    const tsBucketSize = 3600;
    //

    const nextBlockInterval = latest.number + blockBucketSize;
    const nextTsInterval = latest.timestamp + tsBucketSize;

    return {
      blockBucket: reqFactory.calcBucket(nextBlockInterval, 1),
      timestampBucket: reqFactory.calcBucket(nextTsInterval, 2),
    };
  }

  async getBuckets(reqFactory: any): Promise<Buckets> {
    const latest: Block = await this.getBlock('latest');
    return {
      currentBuckets: this.getCurrentBuckets(reqFactory, latest),
      nextBuckets: this.getNextBuckets(reqFactory, latest),
    };
  }

  // TODO shouldn't return void
  handleRequest(request: any): void {
    if (!this.isValid(request.address)) return;

    this.config.logger.debug(`[${request.address}] Discovered`);
    if (!this.config.cache.has(request.address)) {
      this.store(request);
    }
  }

  async backupScanBlockchain(): Promise<IntervalID> {
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

  async watchBlockchain(): Promise<IntervalID> {
    const reqFactory = await this.config.eac.requestFactory();

    const { currentBuckets, nextBuckets } = await this.getBuckets(reqFactory);

    // Start watching the current buckets right away.
    reqFactory.watchRequestsByBucket(
      currentBuckets.blockBucket,
      this.handleRequest
    );
    reqFactory.watchRequestsByBucket(
      currentBuckets.timestampBucket,
      this.handleRequest
    );
    reqFactory.watchRequestsByBucket(
      nextBuckets.blockBucket,
      this.handleRequest
    );
    reqFactory.watchRequestsByBucket(
      nextBuckets.timestampBucket,
      this.handleRequest
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

  // async fill(request) {
  //   const txRequest = await this.config.eac.transactionRequest(request.address);
  //   txRequest.fillWithParams(request.uintArgs);
  //   return txRequest;
  // }

  // async scan(
  //   left: number,
  //   right: number,
  //   firstRequest: String,
  //   shouldStore: Function,
  //   atBound: Function,
  //   getNext: Function
  // ): Promise<any> {
  //   let currentRequestAddress = firstRequest;

  //   // Return if NULL_ADDRESS and no new transaction requests found.
  //   if (!this.isValid(currentRequestAddress)) return;

  //   // Loop the cache storage logic while we still get valid transaction requests.
  //   while (currentRequestAddress !== this.config.eac.Constants.NULL_ADDRESS) {
  //     this.config.logger.debug(`[${currentRequestAddress}] Discovered.`);
  //     // try get the value from cache, fallback to -1 as default
  //     let windowStart = parseInt(
  //       this.config.cache.get(currentRequestAddress, -1)
  //     );

  //     if (windowStart === -1) {
  //       // If it's not already in cache, find windowStart.
  //       const txRequest = await this.fill(currentRequestAddress);
  //       windowStart = txRequest.windowStart;

  //       if (
  //         txRequest &&
  //         shouldStore(windowStart) &&
  //         this.isUpcoming(txRequest)
  //       ) {
  //         // If the windowStart returns True to `shouldStore(...)`, store it.
  //         this.store(txRequest);
  //       }
  //     }

  //     // always check if we already hit bounds
  //     // TODO remove bounds -- no longer needed with the buckets
  //     if (atBound(windowStart)) {
  //       // Stop looping if we hit the bounds.
  //       break;
  //     }

  //     // Get the next transaction request.
  //     currentRequestAddress = await getNext(currentRequestAddress);

  //     // Hearbeat
  //     if (currentRequestAddress === this.config.eac.Constants.NULL_ADDRESS) {
  //       this.config.logger.debug('No new requests discovered.');
  //       break;
  //     }
  //   }
  // }

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
      txRequests.forEach((txRequest: TxRequest) => {
        txRequest
          .refreshData()
          .then(() => this.router.route(this.config, txRequest));
      });
    });
  }

  // TODO extract to a utils?
  getBlock(number = 'latest'): Promise<Block> {
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
