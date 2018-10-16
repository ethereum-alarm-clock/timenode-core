import Config from '../Config';
import IRouter from '../Router';
import { IntervalId, Address } from '../Types';
import CacheScanner from './CacheScanner';
import { BucketCalc, IBucketCalc } from '../Buckets';
import { ITxRequestRaw } from '../Types/ITxRequest';
import { TxStatus } from '../Enum';
import { Buckets } from './Buckets';

export default class ChainScanner extends CacheScanner {
  public bucketCalc: IBucketCalc;

  public chainInterval: IntervalId;
  public eventWatchers: {} = {};
  public requestFactory: Promise<any>;

  private buckets: Buckets;

  constructor(config: Config, router: IRouter) {
    super(config, router);
    this.requestFactory = config.eac.requestFactory();
    this.bucketCalc = new BucketCalc(config.util, this.requestFactory);
    this.buckets = new Buckets(this.requestFactory, this.config.logger);

    this.handleRequest = this.handleRequest.bind(this);
  }

  public async watchBlockchain(): Promise<void> {
    const newBuckets = await this.bucketCalc.getBuckets();
    await this.buckets.update(newBuckets, this.handleRequest);
  }

  protected async stopAllWatchers(): Promise<void> {
    return this.buckets.stop();
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
