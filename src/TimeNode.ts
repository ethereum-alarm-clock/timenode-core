import Actions from './Actions';
import Config from './Config';
import { Networks } from './Enum';
import Scanner from './Scanner';
import Router from './Router';
import Version from './Version';

const MAX_RETRIES = 10;

export default class TimeNode {
  public actions: Actions;
  public config: Config;
  public scanner: Scanner;
  public router: Router;
  private reconnectTries: number;

  constructor(config: Config) {
    this.actions = new Actions(config);
    this.config = config;
    this.router = new Router(this.config, this.actions);
    this.scanner = new Scanner(this.config, this.router);

    if (this.isWSConnection()) {
      const { web3: { currentProvider }} = this.config;
      currentProvider.on('error', (err: any) => {
        this.config.logger.error('WS Error' + (err.message || err));
        this.handleDisconnectingWS();
      });
      currentProvider.on('end', (err: any) => {
        this.config.logger.debug('WS End'  + (err.message || err));
        this.handleDisconnectingWS();
      });
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

  private isWSConnection() : boolean {
    return this.config.providerUrl.indexOf('wss://') !== -1;
  }

  private handleDisconnectingWS(): void {
    if (this.scanner.scanning && this.reconnectTries < MAX_RETRIES) {
      this.reconnectWSConnection();
    } else {
      this.config.logger.info('Failed to reconnect. Stopping Timenode');
      this.stopScanning();
    }
  }

  private reconnectWSConnection(): void {
    this.config.logger.debug('Attempting reconnect...');
    const { web3 } = this.config;
    try {
      web3.setProvider(this.config.providerUrl);
      this.config.logger.debug('Restarting Scanning...');
      this.startScanning();
      this.reconnectTries = 0;
    } catch (err) {
      this.config.logger.error(err.message);
      this.reconnectTries ++;
      this.handleDisconnectingWS();
    }
  }
}
