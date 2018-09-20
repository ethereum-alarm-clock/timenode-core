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

    if (this.config.providerUrl.indexOf('wss://') !== -1) {
      this.handleDisconnectingWS();
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

  private handleDisconnectingWS(): void {
    const { logger, web3 } = this.config;
    const { currentProvider } = web3;
    currentProvider.on('error', (err: any) => {
      logger.debug('WS Error' + err);
      logger.debug('Attempting reconnect...');
      web3.setProvider(this.config.providerUrl);
      logger.debug('Restarting Scanning...');
      this.startScanning();
    });
    currentProvider.on('end', (err: any) => {
      logger.debug('WS End' + err);
      logger.debug('Attempting reconnect...');
      web3.setProvider(this.config.providerUrl);
      logger.debug('Restarting Scanning...');
      this.startScanning();
    });
  }
}
