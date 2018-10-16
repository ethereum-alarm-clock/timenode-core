import Config from '../Config';
import IRouter from '../Router';
import { IntervalId, Address } from '../Types';
import CacheScanner from './CacheScanner';
import { Bucket, IBuckets, BucketCalc, IBucketCalc } from '../Buckets';
import { ITxRequestRaw } from '../Types/ITxRequest';
import { TxStatus } from '../Enum';

export default class ChainScanner extends CacheScanner {
  public bucketCalc: IBucketCalc;

  public chainInterval: IntervalId;
  public eventWatchers: {} = {};
  public requestFactory: Promise<any>;

  private buckets: IBuckets = {
    currentBuckets: {
      blockBucket: -1,
      timestampBucket: -1
    },
    nextBuckets: {
      blockBucket: -1,
      timestampBucket: -1
    },
    afterNextBuckets: {
      blockBucket: -1,
      timestampBucket: -1
    }
  };

  constructor(config: Config, router: IRouter) {
    super(config, router);
    this.requestFactory = config.eac.requestFactory();
    this.bucketCalc = new BucketCalc(config.util, this.requestFactory);

    this.handleRequest = this.handleRequest.bind(this);
  }

  public async watchBlockchain(): Promise<void> {
    const buckets = await this.bucketCalc.getBuckets();

    if (
      this.buckets.nextBuckets.blockBucket === buckets.currentBuckets.blockBucket ||
      this.buckets.afterNextBuckets.blockBucket === buckets.currentBuckets.blockBucket
    ) {
      await this.stopWatcher(this.buckets.currentBuckets.blockBucket);

      // If we are only doing one bucket step up we only need to start one watcher.
      this.buckets.currentBuckets.blockBucket = buckets.currentBuckets.blockBucket;
    } else {
      // Start watching the current buckets right away.
      this.buckets.currentBuckets.blockBucket = await this.watchRequestsByBucket(
        buckets.currentBuckets.blockBucket,
        this.buckets.currentBuckets.blockBucket
      );
    }

    this.buckets.nextBuckets.blockBucket = await this.watchRequestsByBucket(
      buckets.nextBuckets.blockBucket,
      this.buckets.nextBuckets.blockBucket
    );
    this.buckets.afterNextBuckets.blockBucket = await this.watchRequestsByBucket(
      buckets.afterNextBuckets.blockBucket,
      this.buckets.afterNextBuckets.blockBucket
    );

    if (
      this.buckets.nextBuckets.timestampBucket === buckets.currentBuckets.timestampBucket ||
      this.buckets.afterNextBuckets.timestampBucket === buckets.currentBuckets.timestampBucket
    ) {
      await this.stopWatcher(this.buckets.currentBuckets.timestampBucket);

      this.buckets.currentBuckets.timestampBucket = buckets.currentBuckets.timestampBucket;
    } else {
      this.buckets.currentBuckets.timestampBucket = await this.watchRequestsByBucket(
        buckets.currentBuckets.timestampBucket,
        this.buckets.currentBuckets.timestampBucket
      );
    }

    this.buckets.nextBuckets.timestampBucket = await this.watchRequestsByBucket(
      buckets.nextBuckets.timestampBucket,
      this.buckets.nextBuckets.timestampBucket
    );
    this.buckets.afterNextBuckets.timestampBucket = await this.watchRequestsByBucket(
      buckets.afterNextBuckets.timestampBucket,
      this.buckets.afterNextBuckets.timestampBucket
    );
  }

  public async watchRequestsByBucket(bucket: Bucket, previousBucket: Bucket): Promise<Bucket> {
    if (bucket !== previousBucket) {
      await this.stopWatcher(previousBucket);
      return this.startWatcher(bucket);
    }

    return previousBucket;
  }

  protected async stopAllWatchers(): Promise<void> {
    for (const type of Object.keys(this.buckets)) {
      for (const key of Object.keys(this.buckets[type])) {
        await this.stopWatcher(this.buckets[type][key]);
        // Reset to default value when stopping TimeNode.
        this.buckets[type][key] = -1;
      }
    }
  }

  protected async startWatcher(bucket: Bucket): Promise<Bucket> {
    const reqFactory = await this.requestFactory;
    try {
      const watcher = await reqFactory.watchRequestsByBucket(bucket, this.handleRequest);
      this.eventWatchers[bucket] = watcher;

      this.config.logger.debug(`Buckets: Watcher for bucket=${bucket} has been started`);
    } catch (err) {
      this.config.logger.error(`Buckets: Starting bucket=${bucket} watching failed!`);
    }

    return bucket;
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
      windowStart: txRequest.params[7],
      status: TxStatus.BeforeClaimWindow
    });
  }
}
