/* eslint no-await-in-loop: 'off' */
declare const require;

import { routeTxRequest } from './routing.js';
const clientVersion = require('../package.json').version;
const SCAN_DELAY = 1;

import Config from './config';

declare const clearInterval;
declare const setInterval;

interface Block {
  number: number;
  timestamp: number;
}

type Bucket= number;

interface BucketPair {
  blockBucket: Bucket;
  timestampBucket: Bucket;
}

interface Buckets {
  currentBuckets: BucketPair;
  nextBuckets: BucketPair;
}

// TODO this is only temporary
interface TxRequest {
  refreshData: Function,
}

type IntervalID = number;

export default class Scanner {
  config: Config;
  ms: number;
  running: boolean;

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
  constructor(ms: number, config: Config) {
    this.config = config;
    this.ms = ms;
    this.running = false;
    this.startupMessage();
  }

  startupMessage() {
    this.logNetwork();
    this.config.logger.info(`EAC.JS-client version.. ${clientVersion}`);
    this.config.logger.info(`Using request factory at ${this.config.factory.address}`);
    this.config.logger.info(`Scanning every ${this.ms/1000} seconds`);
  }

  logNetwork() {
    // TODO: extract this out to a constants package.
    const Networks = {
      0: 'Private',
      1: 'Mainnet',
      2: 'Morden',
      3: 'Ropsten',
      4: 'Rinkeby',
      42: 'Kovan',
    };
    this.config.web3.version.getNetwork((err, res) => {
      if (err) {
        this.config.logger.error('Unable to determine Ethereum network..');
      }
      this.config.logger.info(`Ethereum network.. ${Networks[res || 0]}`);
    });

    const provider = this.config.web3.currentProvider;

    let providerUrl;
    if (provider) {
      providerUrl = provider.host ? provider.host : provider.connection.url;
    } else {
      providerUrl = 'Unknown';
    }

    this.config.logger.info(`Web3 provider.. ${providerUrl}`);
  }

  async start() {
    // Clear the intervals if this Scanner is already started via a hard reboot.
    if (this.running) this.stop();

    // Create the interval for processing the transaction requests in cache.
    this.cacheScanner = setInterval(() => {
      this.scanCache().catch((err) => this.config.logger.error(err));
    }, this.ms);

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
    this.running = true;
  }

  async stop() {
    // Clear scanning intervals.
    clearInterval(this.cacheScanner);
    clearInterval(this.chainScanner);

    // Mark that we've stopped.
    this.config.logger.info('Scanner STOPPED');
    this.running = false;
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
  getWindowForBlock(block: Block) {
    const leftBlockNumber = this.getLeftBlockNumber(block);
    const rightBlockNumber = leftBlockNumber + this.config.scanSpread * 2;

    return { leftBlockNumber, rightBlockNumber };
  }

  //TODO correctness?
  getLeftBlockNumber(block: Block): number {
    const leftBlock = block.number - this.config.scanSpread;
    return leftBlock < 0 ? 0 : leftBlock;
  }

  //TODO correctness?
  getRightTimestamp(leftTimestamp, latestTimestamp): number {
    return 2 * latestTimestamp - leftTimestamp;
  }

  //TODO move this to requestFactory instance
  getCurrentBuckets(reqFactory: any, latest: Block): BucketPair {
    return {
      blockBucket: reqFactory.calcBucket(latest),
      timestampBucket: reqFactory.calcBucket(latest),
    }
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
    }
  }

  async backupScanBlockchain(): Promise<IntervalID> {
    // TODO only init reqFactory once, so check here with a function before calling again
    const reqFactory = await this.config.eac.requestFactory();

    const {
      currentBuckets,
      nextBuckets,
    } = await this.getBuckets(reqFactory);

    // TODO extract this
    const handleRequests = (request): void => {
      if (!this.isCorrect(request.address)) return;
      this.config.logger.debug(`[${request.address}] Discovered.`);
      if (!this.config.cache.has(request.address)) {
        // If it's not already in cache, find windowStart.
        this.store(request);
      }
    };

    // TODO: extract this out
    (await reqFactory.getRequestsByBucket(currentBuckets.blockBucket)).map(handleRequests);
    (await reqFactory.getRequestsByBucket(currentBuckets.timestampBucket)).map(handleRequests);
    (await reqFactory.getRequestsByBucket(nextBuckets.blockBucket)).map(
      handleRequests
    );
    (await reqFactory.getRequestsByBucket(nextBuckets.tsBucket)).map(handleRequests);
    //

    // Set a recursive interval to continue this "scan" every ms/1000 seconds.
    return setInterval(() => {
      this.backupScanBlockchain().catch((err) => this.config.logger.error(err));
    }, this.ms);
  }

  async watchBlockchain(): Promise<IntervalID> {
    const reqFactory = await this.config.eac.requestFactory();

    const latestBlock: Block = await this.getBlock('latest');

    const blockBucket = reqFactory.calcBucket(latestBlock.number, 1);
    const tsBucket = reqFactory.calcBucket(latestBlock.timestamp, 2);

    const handleRequests = (request) => {
      if (!this.isCorrect(request.address)) return;
      this.config.logger.debug(`[${request.address}] Discovered.`);
      if (!this.config.cache.has(request.address)) {
        // If it's not already in cache, find windowStart.
        this.store(request);
      }
    };

    // Start watching the current buckets right away.
    reqFactory.watchRequestsByBucket(blockBucket, handleRequests);
    reqFactory.watchRequestsByBucket(tsBucket, handleRequests);
    // Also start watching the next one now.
    this.watchNextBuckets(latestBlock);

    this.config.logger.info(`Watching STARTED`);
    this.config.logger.debug(`Watching for new Requests from current bucket `);

    // Set an timeout for every hour
    return setInterval(async () => {
      const curBlock = await this.getBlock('latest');
      this.watchNextBuckets(curBlock);
    }, 60 * 60 * 1000);
  }

  async watchNextBuckets(block) {
    const reqFactory = await this.config.eac.requestFactory();

    const next = await this.getNextBuckets(block);

    const handleRequests = (request) => {
      if (!this.isCorrect(request.address)) return;
      this.config.logger.debug(`[${request.address}] Discovered.`);
      if (!this.config.cache.has(request.address)) {
        // If it's not already in cache, find windowStart.
        this.store(request);
      }
    };

    reqFactory.watchRequestsByBucket(next.blockBucket, handleRequests);
    reqFactory.watchRequestsByBucket(next.tsBucket, handleRequests);
  }

  /**
   * Verifies that a transaction request is valid.
   * @param {String} requestAddress Address of the transaction request.
   */
  isCorrect(requestAddress: String): boolean {
    // We hit the NULL_ADDRESS so there are no more transaction requests in the tracker.
    if (requestAddress === this.config.eac.Constants.NULL_ADDRESS) {
      // TODO: change this error message, it's old
      this.config.logger.debug('No new request discovered.');
      return false;
    } else if (!this.config.eac.Util.checkValidAddress(requestAddress)) {
      // This should, conceivably, never happen unless there is a bug in eac.js-lib.
      throw new Error(
        `[${requestAddress}] Received invalid response from Request Tracker`
      );
    }

    return true;
  }

  // @param request {Object} of form {address: 0xAF...34, uintArgs: uint[12]}
  async fill(request) {
    const txRequest = await this.config.eac.transactionRequest(request.address);
    txRequest.fillWithParams(request.uintArgs);
    // await txRequest.fillData()

    return txRequest;
  }

  /**
   * Scan is the main driver function of the Scanner class.
   * @param {Number} left The left bound to scan.
   * @param {Number} right The right bound to scan.
   * @param {String} firstRequest Address of a transaction request to start scanning from.
   * @param {Function} shouldStore A function taking windowStart and returning True is the transaction request should be stored.
   * @param {Function} atBound A function taking windowStart and returning True if scanning should continue and False if at bounds.
   * @param {Function} getNext A function taking the currentRequestAddress and returning the next request address.
   * @returns {void}
   */
  async scan(
    left: number,
    right: number,
    firstRequest: String,
    shouldStore: Function,
    atBound: Function,
    getNext: Function
  ): Promise<any> {
    let currentRequestAddress = firstRequest;

    // Return if NULL_ADDRESS and no new transaction requests found.
    if (!this.isCorrect(currentRequestAddress)) return;

    // Loop the cache storage logic while we still get valid transaction requests.
    while (currentRequestAddress !== this.config.eac.Constants.NULL_ADDRESS) {
      this.config.logger.debug(`[${currentRequestAddress}] Discovered.`);
      // try get the value from cache, fallback to -1 as default
      let windowStart = parseInt(
        this.config.cache.get(currentRequestAddress, -1)
      );

      if (windowStart === -1) {
        // If it's not already in cache, find windowStart.
        const txRequest = await this.fill(currentRequestAddress);
        windowStart = txRequest.windowStart;

        if (
          txRequest &&
          shouldStore(windowStart) &&
          this.isUpcoming(txRequest)
        ) {
          // If the windowStart returns True to `shouldStore(...)`, store it.
          this.store(txRequest);
        }
      }

      // always check if we already hit bounds
      // TODO remove bounds -- no longer needed with the buckets
      if (atBound(windowStart)) {
        // Stop looping if we hit the bounds.
        break;
      }

      // Get the next transaction request.
      currentRequestAddress = await getNext(currentRequestAddress);

      // Hearbeat
      if (currentRequestAddress === this.config.eac.Constants.NULL_ADDRESS) {
        this.config.logger.debug('No new requests discovered.');
        break;
      }
    }
  }

  async scanCache() {
    if (this.config.cache.len() === 0) return; // nothing stored in cache

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
          .then(() => routeTxRequest(this.config, txRequest));
      });
    });
  }

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
    this.config.logger.info(`[${request.address}] Storing.`);
    this.config.cache.set(request.address, request.params[7]);
  }
}
