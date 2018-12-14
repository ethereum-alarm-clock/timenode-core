import Config from '../Config';
import IRouter from '../Router';
import { Util } from '@ethereum-alarm-clock/lib';

export default class BaseScanner {
  public config: Config;
  public router: IRouter;
  public util: Util;

  constructor(config: Config, router: IRouter) {
    this.config = config;
    this.util = config.util;
    this.router = router;
  }
}
