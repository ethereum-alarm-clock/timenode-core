import { IEconomicStrategy } from '../EconomicStrategy';
import { ILogger, DefaultLogger } from '../Logger';

//TODO remove factory
export interface IConfigParams {
  autostart: boolean;
  eac: any;
  economicStrategy?: IEconomicStrategy;
  factory?: any;
  logger: ILogger | null;
  ms?: any;
  password?: any;
  provider: any;
  scanSpread: number | null;
  walletStores?: any;
  web3: any;
}
