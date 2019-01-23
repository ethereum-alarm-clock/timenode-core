import { IEconomicStrategy } from '../EconomicStrategy';
import { ILogger } from '../Logger';

export interface IConfigParams {
  autostart?: boolean;
  claiming?: boolean;
  economicStrategy?: IEconomicStrategy;
  logger?: ILogger | null;
  maxRetries?: number;
  ms?: any;
  password?: any;
  providerUrls: string[];
  scanSpread?: number | null;
  statsDb?: any;
  walletStores?: any;
  walletStoresAsPrivateKeys?: boolean;
  directTxPool?: boolean;
}
