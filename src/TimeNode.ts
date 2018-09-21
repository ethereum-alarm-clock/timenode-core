import Actions from './Actions';
import Config from './Config';
import { Networks } from './Enum';
import Scanner from './Scanner';
import Router from './Router';
import Version from './Version';
import W3Util from './Util';

declare const process: any;
declare const setTimeout: any;

const MAX_RETRIES = 25;

export default class TimeNode {
  public actions: Actions;
  public config: Config;
  public scanner: Scanner;
  public router: Router;

  private reconnectTries: number = 0;
  private reconnecting: boolean = false;

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

    const { providerUrl, logger } = this.config;
    if (W3Util.isWSConnection(providerUrl)) {
      logger.debug('WebSockets provider detected! Setting up reconnect events...');
      this.setupWsReconnect();
    }

    this.startupMessage();
  }

  public setupWsReconnect(): void {
    const {
      logger,
      web3: { currentProvider }
    } = this.config;

    /* tslint:disable */
    currentProvider.on('error', (err: any) => {
      logger.debug(`[WS ERROR] ${JSON.stringify(err)}`);
      setTimeout(() => {
        this.handleWsDisconnect();
      }, this.reconnectTries * 1000);
    });

    currentProvider.on('end', (err: any) => {
      logger.debug(`[WS END] Type= ${err.type} Reason= ${err.reason}`);
      setTimeout(() => {
        this.handleWsDisconnect();
      }, this.reconnectTries * 1000);
    });
  }

  public async handleWsDisconnect(): Promise<void> {
    const { logger } = this.config;
    if (this.reconnectTries >= MAX_RETRIES) {
      logger.debug('Too many reconnect tries!');
      this.stopScanning();
      process.exit(1);
      return;
    }
    if (this.reconnecting) {
      logger.debug('Currently reconnecting!');
      return;
    }

    this.reconnecting = true;
    if (await this.wsReconnect()) {
      logger.info('Reconnected!');
      await this.startScanning();
      this.reconnectTries = 0;
      this.setupWsReconnect();
      this.reconnecting = false;
      return;
    }
    this.reconnecting = false;
    this.reconnectTries++;
    setTimeout(() => {
      this.handleWsDisconnect();
    }, this.reconnectTries * 1000);
  }

  public async wsReconnect(): Promise<boolean> {
    const { logger, providerUrl } = this.config;
    logger.debug('Attempting WS Reconnect.');
    try {
      this.config.web3 = W3Util.getWeb3FromProviderUrl(providerUrl);
      this.config.util = new W3Util(this.config.web3);
      this.scanner.util = this.config.util;
      if (await this.config.util.isWatchingEnabled()) {
        return true;
      } else {
        throw new Error('Wrong!');
      }
    } catch (err) {
      logger.error(err.message);
      logger.info(`Reconnect tries: ${this.reconnectTries}`);
      return false;
    }
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
}
