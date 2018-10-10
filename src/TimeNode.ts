import Actions from './Actions';
import Config from './Config';
import { Networks } from './Enum';
import Scanner from './Scanner';
import Router from './Router';
import Version from './Version';
import W3Util from './Util';
import WsReconnect from './WsReconnect';
export default class TimeNode {
  public actions: Actions;
  public config: Config;
  public scanner: Scanner;
  public router: Router;
  public wsReconnect: WsReconnect;

  constructor(config: Config) {
    this.actions = new Actions(
      config.wallet,
      config.ledger,
      config.logger,
      config.cache,
      config.util,
      config.pending,
      config.economicStrategyManager
    );

    this.router = new Router(
      config.claiming,
      config.cache,
      config.logger,
      this.actions,
      config.economicStrategyManager,
      config.wallet
    );

    this.config = config;
    this.scanner = new Scanner(this.config, this.router);

    const { logger, providerUrls } = this.config;
    if (W3Util.isWSConnection(providerUrls[0])) {
      logger.debug('WebSockets provider detected! Setting up reconnect events...');
      this.wsReconnect = new WsReconnect(this);
      this.wsReconnect.setup();
    }

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
      await this.scanner.stop();
    }

    return this.scanner.start();
  }

  public stopScanning(): Promise<boolean> {
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

  public getClaimedNotExecutedTransactions(): object {
    const cachedTransactionsAddresses = this.config.cache.stored();
    const accounts = this.config.wallet.getAddresses();

    const claimedPendingExecution: {} = {};

    for (const account of accounts) {
      claimedPendingExecution[account] = [];
    }

    for (const address of cachedTransactionsAddresses) {
      const cachedTx = this.config.cache.get(address);

      const claimerIndex = accounts.indexOf(cachedTx.claimedBy);
      if (claimerIndex !== -1 && !cachedTx.wasCalled) {
        const claimer = this.config.wallet.getAddresses()[claimerIndex];
        claimedPendingExecution[claimer].push(address);
      }
    }

    return claimedPendingExecution;
  }

  public getUnsucessfullyClaimedTransactions(): object {
    const accounts = this.config.wallet.getAddresses();

    const unsuccessfulClaims: {} = {};

    for (const account of accounts) {
      const failedClaims = this.config.statsDb
        .getFailedClaims(account)
        .map(entry => entry.txAddress);
      unsuccessfulClaims[account] = failedClaims;
    }

    return unsuccessfulClaims;
  }
}
