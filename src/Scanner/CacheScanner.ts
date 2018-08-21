import { IntervalId, Address, ITxRequest } from '../Types';
import BaseScanner from './BaseScanner';
import { CacheStates } from '../Enum';
import IRouter from '../Router';
import Config from '../Config';

export default class CacheScanner extends BaseScanner {
  public cacheInterval: IntervalId;

  constructor(config: Config, router: IRouter) {
    super(config, router);
  }

  public async scanCache(): Promise<CacheStates> {
    if (this.config.cache.isEmpty()) {
      return CacheStates.EMPTY; // 1 = cache is empty
    }

    this.config.cache
      .stored()
      .filter((address: Address) => this.config.cache.get(address))
      .map((address: Address) => this.config.eac.transactionRequest(address))
      .forEach(async (txRequest: ITxRequest) => {
        await txRequest.refreshData();
        this.router.route(txRequest);
      });

    return CacheStates.REFRESHED; // 0 = cache loaded successfully
  }
}
