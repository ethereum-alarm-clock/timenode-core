import Actions from './Actions';
import Config from './Config';
import { Networks } from './Enum';
import Scanner from './Scanner';
import Router from './Router';
import Version from './Version';

export default class TimeNode {
  public actions: Actions;
  public config: Config;
  public scanner: Scanner;
  public router: Router;

  constructor(config: Config) {
    this.actions = new Actions(config);
    this.config = config;
    this.router = new Router(this.config, this.actions);
    this.scanner = new Scanner(this.config, this.router);

    this.config.statsDb.initialize(this.config.wallet.getAddresses());

    this.startupMessage();
  }

  public startupMessage(): void {
    this.config.logger.info('EAC-TimeNode');
    this.config.logger.info('Version: ' + Version);
  }

  public logNetwork(): void {
    this.config.web3.version.getNetwork((error: any, result: number) => {
      if (error) {
        throw new Error(error);
      } else {
        this.config.logger.info('Operating on ' + Networks[result]);
      }
    });
  }

  public async startScanning(): Promise<boolean> {
    // If already scanning, hard-reset the Scanner module.
    if (this.scanner.scanning) {
      this.scanner.stop();
    }

    return this.scanner.start();
  }

  public stopScanning(): boolean {
    return this.scanner.stop();
  }
}
