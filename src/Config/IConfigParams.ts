import { IEconomicStrategy } from '../EconomicStrategy';
import { ILogger } from '../Logger';

export interface IConfigParams {
  autostart?: boolean;
  client?: string;
  claiming?: boolean;
  disableDetection?: boolean;
  economicStrategy?: IEconomicStrategy;
  logger?: ILogger | null;
  ms?: any;
  password?: any;
  providerUrl: string;
  scanSpread?: number | null;
  statsDb?: any;
  walletStores?: any;
  walletStoresAsPrivateKeys?: boolean;
}
