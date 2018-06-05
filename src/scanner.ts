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
    const Networks = {
      0: 'Private',
      1: 'Mainnet',
      2: 'Mordern',
      3: 'Ropsten',
      4: 'Rinkeby',
      42: 'Kovan',
    };
    this.config.web3.version.getNetwork((err, res) => {
      if (err) {
        this.config.logger.error(`Unable to connect to a Network`);
      }
      this.config.logger.info(`Network : ${Networks[res || 0]} Network`);
    });

    const provider = this.config.web3.currentProvider;

    let providerUrl;
    if (provider) {
      providerUrl = provider.host ? provider.host : provider.connection.url;
    } else {
      providerUrl = 'Unknown';
    }

    this.config.logger.info(`Web3 provider : ${providerUrl}`);
  }

  async start() {
    // Reset the intervals if already started.
    if (this.running) this.stop();

    // Set interval for scanning for actionable transaction requests in the cache.
    this.cacheScanner = setInterval(() => {
      this.scanCache().catch((err) => this.config.logger.error(err));
    }, this.ms);

    // Helper function to determine if we're on a provider which allows
    // us to use the `eth_getFilerLogs` method, and thereby are allowed
    // to watch events.
    const watchingEnabled = await new Promise((resolve) => {
      this.config.web3.currentProvider.sendAsync(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getFilterLogs',
          params: [],
        },
        async (e) => {
          if (e !== null) {
            this.config.logger.info('Watching DISABLED');
            resolve(false);
          }
          this.config.logger.info('Watching ENABLED');
          resolve(true);
        }
      );
    });

    if (watchingEnabled) {
      this.chainScanner = this.watchBlockchain();
    } else {
      this.config.logger.info('-Initiating Backup Scanner-');
      // backup scan
      this.chainScanner = this.backupScanBlockchain();
    }

    this.scanCache().catch((err) => this.config.logger.error(err));

    // Mark that we've started.
    this.running = true;
    this.config.logger.info('Scanner STARTED');
  }

  async stop() {
    // Clear scanning intervasls.
    clearInterval(this.cacheScanner);
    clearInterval(this.chainScanner);

    // if (this.requestWatcher) {
    //   await this.requestFactory.stopWatch(this.requestWatcher);
    //   this.log.info('Watching STOPPED');
    // }

    // Mark that we've stopped.
    this.running = false;
    this.config.logger.info('Scanner STOPPED');
  }

  // isValidBlock(block) {
  //   if (!block) {
  //     return false;
  //   }

  //   return true;
  // }

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

  getWindowForBlock(latest) {
    const leftBlock = this.getLeftBlock(latest);
    const rightBlock = leftBlock + this.config.scanSpread * 2;

    return { leftBlock, rightBlock };
  }

  getLeftBlock(latest) {
    const leftBlock = latest - this.config.scanSpread;
    return leftBlock < 0 ? 0 : leftBlock;
  }

  getRightTimestamp(leftTimestamp, latestTimestamp) {
    return 2 * latestTimestamp - leftTimestamp;
  }

  // @param request {Object} of form {address: 0xAF...34, uintArgs: uint[12]}
  // async handleRequests (request) {
  //   if (!this.isCorrect(request.address)) return;
  //   this.log.debug(`[${request.address}] Discovered.`)
  //   if (!this.cache.has(request.address)) {
  //     // If it's not already in cache, find windowStart.
  //     this.store(request)
  //   }
  // }

  async backupScanBlockchain(): Promise<any> {
    const reqFactory = await this.config.eac.requestFactory();

    const latestBlock: Block = await this.getBlock('latest');

    const blockBucket = reqFactory.calcBucket(latestBlock.number, 1);
    const tsBucket = reqFactory.calcBucket(latestBlock.timestamp, 2);

    const next = await this.getNextBuckets(latestBlock);

    const handleRequests = (request): void => {
      if (!this.isCorrect(request.address)) return;
      this.config.logger.debug(`[${request.address}] Discovered.`);
      if (!this.config.cache.has(request.address)) {
        // If it's not already in cache, find windowStart.
        this.store(request);
      }
    };

    // TODO: extract this out
    (await reqFactory.getRequestsByBucket(blockBucket)).map(handleRequests);
    (await reqFactory.getRequestsByBucket(tsBucket)).map(handleRequests);
    (await reqFactory.getRequestsByBucket(next.blockBucket)).map(
      handleRequests
    );
    (await reqFactory.getRequestsByBucket(next.tsBucket)).map(handleRequests);

    return setInterval(() => {
      this.backupScanBlockchain().catch((err) => this.config.logger.error(err));
    }, this.ms);
  }

  async getNextBuckets(block: Block) {
    const reqFactory = await this.config.eac.requestFactory();

    const blockBucketSize = 240;
    const tsBucketSize = 3600;

    const nextBlockInterval = block.number + blockBucketSize;
    const nextTsInterval = block.timestamp + tsBucketSize;

    const blockBucket = reqFactory.calcBucket(nextBlockInterval, 1);
    const tsBucket = reqFactory.calcBucket(nextTsInterval, 2);

    return {
      blockBucket,
      tsBucket,
    };
  }

  async watchBlockchain() {
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
