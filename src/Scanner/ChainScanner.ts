import Config from '../Config';
import IRouter from '../Router';
import { IntervalId, Address } from '../Types';
import CacheScanner from './CacheScanner';
import { Bucket, IBuckets, BucketCalc, IBucketCalc } from '../Buckets';
import { ITxRequestRaw } from '../Types/ITxRequest';

export default class ChainScanner extends CacheScanner {
  public bucketCalc: IBucketCalc;
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
  public chainInterval: IntervalId;
  public eventWatchers: {} = {};
  public requestFactory: Promise<any>;

  constructor(config: Config, router: IRouter) {
    super(config, router);
    this.requestFactory = config.eac.requestFactory();
    this.bucketCalc = new BucketCalc(config, this.requestFactory);
  }

  public async watchBlockchain(): Promise<void> {
    const buckets = await this.bucketCalc.getBuckets();

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

  public async watchRequestsByBucket(bucket: Bucket, previousBucket: Bucket): Promise<number> {
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

  protected async stopWatcher(bucket: Bucket) {
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

  private handleRequest(request: ITxRequestRaw): void {
    if (!this.isValid(request.address)) {
      throw new Error(`[${request.address}] NOT VALID`);
    }

    this.config.logger.info('Discovered.', request.address);
    if (!this.config.cache.has(request.address)) {
      this.store(request);

      this.config.wallet.getAddresses().forEach((from: Address) => {
        this.config.statsDb.discovered(from, request.address);
      });
    }
  }

  private isValid(requestAddress: string): boolean {
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

  private store(txRequest: ITxRequestRaw) {
    this.config.cache.set(txRequest.address, {
      claimedBy: null,
      wasCalled: false,
      windowStart: txRequest.params[7]
    });
  }
}
