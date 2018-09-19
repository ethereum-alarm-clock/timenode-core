import { IntervalId, Address, ITxRequest } from '../Types';
import BaseScanner from './BaseScanner';
import IRouter from '../Router';
import Config from '../Config';

export default class CacheScanner extends BaseScanner {
  public cacheInterval: IntervalId;
  private routes: Set<string> = new Set<string>();

  constructor(config: Config, router: IRouter) {
    super(config, router);
  }

  public async scanCache(): Promise<void> {
    if (this.config.cache.isEmpty()) {
      return;
    }

    this.config.cache
      .stored()
      .filter((address: Address) => this.config.cache.get(address))
      .map((address: Address) => this.config.eac.transactionRequest(address))
      .forEach((txRequest: ITxRequest) => this.route(txRequest));
  }

  private async route(txRequest: ITxRequest): Promise<void> {
    const address = txRequest.address;
    if (!this.routes.has(address)) {
      this.routes.add(address);

      try {
        await txRequest.refreshData();
        this.router.route(txRequest);
      } finally {
        this.routes.delete(address);
      }
    } else {
      this.config.logger.debug(`Routing in progress. Skipping...`, address);
    }
  }
}
