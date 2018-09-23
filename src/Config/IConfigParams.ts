import { IEconomicStrategy } from '../EconomicStrategy';
import { ILogger } from '../Logger';

export interface IConfigParams {
  autostart?: boolean;
  claiming?: boolean;
  economicStrategy?: IEconomicStrategy;
  endpoints?: string[];
  logger?: ILogger | null;
  ms?: any;
  password?: any;
  providerUrl: string;
  scanSpread?: number | null;
  statsDb?: any;
  walletStores?: any;
  walletStoresAsPrivateKeys?: boolean;
}
