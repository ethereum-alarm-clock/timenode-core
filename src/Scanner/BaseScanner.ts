import Config from '../Config';
import IRouter from '../Router';
import W3Util from '../Util';

export default class BaseScanner {
  public config: Config;
  public router: IRouter;
  public util: W3Util;

  constructor(config: Config, router: IRouter) {
    this.config = config;
    this.util = config.util;
    this.router = router;
  }
}
