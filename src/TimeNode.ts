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
    this.logNetwork();
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

  public startClaiming(): boolean {
    this.config.claiming = true;
    return this.config.claiming;
  }

  public stopClaiming(): boolean {
    this.config.claiming = false;
    return this.config.claiming;
  }

  public getClaimedNotExecutedTransactions(): string[] {
    const cachedTransactionsAddresses = this.config.cache.stored();
    const timenodeAddresses = this.config.wallet.getAddresses();
    const transactions = [];

    for (const address of cachedTransactionsAddresses) {
      const cachedTx = this.config.cache.get(address);

      if (timenodeAddresses.indexOf(cachedTx.claimedBy) !== -1 && !cachedTx.wasCalled) {
        transactions.push(address);
      }
    }

    return transactions;
  }

  public getUnsucessfullyClaimedTransactions(): string[] {
    const cachedTransactionsAddresses = this.config.cache.stored();
    const timenodeAddresses = this.config.wallet.getAddresses();
    const transactions = [];

    for (const address of cachedTransactionsAddresses) {
      const cachedTx = this.config.cache.get(address);

      if (cachedTx.claimingFailed && timenodeAddresses.indexOf(cachedTx.claimedBy) === -1) {
        transactions.push(address);
      }
    }

    return transactions;
  }
}
