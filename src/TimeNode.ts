import Actions from './Actions';
import Config from './Config';
import { Networks } from './Enum';
import Scanner from './Scanner';
import Router from './Router';
import Version from './Version';
import Util from './Util';

export default class TimeNode {
  actions: Actions;
  config: Config;
  scanner: Scanner;
  router: Router;

  constructor(config: Config) {
    this.actions = new Actions(config);
    this.config = config;
    this.config.util = new Util(config);
    this.router = new Router(this.config, this.actions);
    this.scanner = new Scanner(this.config, this.router);

    this.startupMessage();
  }

  startupMessage(): void {
    this.config.logger.info('EAC-TimeNode');
    this.config.logger.info('Version: ' + Version);
  }

  logNetwork(): void {
    this.config.web3.version.getNetwork((error: any, result: number) => {
      if (error) {
        throw new Error(error);
      } else {
        this.config.logger.info('Operating on ' + Networks[result]);
      }
    });
  }

  async startScanning(): Promise<boolean> {
    // If already scanning, hard-reset the Scanner module.
    if (this.scanner.scanning) {
      this.scanner.stop();
    }

    return this.scanner.start();
  }

  stopScanning(): boolean {
    return this.scanner.stop();
  }
}
