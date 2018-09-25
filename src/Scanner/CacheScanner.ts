import { IntervalId, ITxRequest } from '../Types';
import BaseScanner from './BaseScanner';
import IRouter from '../Router';
import Config from '../Config';
import { TxStatus } from '../Enum';

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

    return this.config.cache
      .stored()
      .map(address => this.config.eac.transactionRequest(address))
      .sort((a, b) => this.prioritize(a, b))
      .forEach(txRequest => this.route(txRequest));
  }

  private prioritize(a: ITxRequest, b: ITxRequest): number {
    const statusA = this.config.cache.get(a.address).status;
    const statusB = this.config.cache.get(b.address).status;

    if (statusA === statusB) {
      return 0;
    }

    return statusA === TxStatus.FreezePeriod && statusB !== TxStatus.FreezePeriod ? -1 : 1;
  }

  private async route(txRequest: ITxRequest): Promise<void> {
    const address = txRequest.address;
    if (!this.routes.has(address)) {
      this.routes.add(address);

      try {
        await txRequest.refreshData();
        await this.router.route(txRequest);
      } finally {
        this.routes.delete(address);
      }
    } else {
      this.config.logger.debug(`Routing in progress. Skipping...`, address);
    }
  }
}
