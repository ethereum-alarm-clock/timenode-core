import Actions from './Actions';
import Config from './Config';
import { Networks } from './Enum';
import Scanner from './Scanner';
import Router from './Router';
import Version from './Version';
import W3Util from './Util';

declare const setTimeout: any;

enum ReconnectMsg {
  NULL = '',
  ALREADY_RECONNECTED = 'Recent reconnection. Not attempting for a few seconds.',
  RECONNECTED = 'Reconnected!',
  MAX_ATTEMPTS = 'Max attempts reached. Stopped TimeNode.',
  RECONNECTING = 'Reconnecting in progress.',
  FAIL = 'Reconnection failed! Trying again...'
}

const MAX_RETRIES = 25;
/* tslint:disable */
// const testerWS = "wss://neatly-tolerant-coral.quiknode.io/73b04107-89ee-4261-9a8f-3c1e946c17b2/CyYMMeeGTb-EeIBHGwORaw==/";

export default class TimeNode {
  public actions: Actions;
  public config: Config;
  public scanner: Scanner;
  public router: Router;

  private reconnectTries: number = 0;
  private reconnecting: boolean = false;
  private reconnected: boolean = false;
  private endpoints: string[];

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

    const endpoints = [
      // testerWS,
      providerUrl
    ];

    this.endpoints = endpoints;

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

    currentProvider.on('error', (err: any) => {
      logger.debug(`[WS ERROR] ${JSON.stringify(err)}`);
      setTimeout(async () => {
        const msg: ReconnectMsg = await this.handleWsDisconnect();
        logger.debug(`[WS RECONNECT] ${msg}`);
      }, this.reconnectTries * 1000);
    });

    currentProvider.on('end', (err: any) => {
      logger.debug(`[WS END] Type= ${err.type} Reason= ${err.reason}`);
      setTimeout(async () => {
        const msg = await this.handleWsDisconnect();
        logger.debug(`[WS RECONNECT] ${msg}`);
      }, this.reconnectTries * 1000);
    });
  }

  public async handleWsDisconnect(): Promise<ReconnectMsg> {
    if (this.reconnected) {
      return ReconnectMsg.ALREADY_RECONNECTED;
    }
    if (this.reconnectTries >= MAX_RETRIES) {
      this.stopScanning();
      return ReconnectMsg.MAX_ATTEMPTS;
    }
    if (this.reconnecting) {
      return ReconnectMsg.RECONNECTING;
    }

    // Try to reconnect.
    this.reconnecting = true;
    if (await this.wsReconnect()) {
      await this.startScanning();
      this.reconnectTries = 0;
      this.setupWsReconnect();
      this.reconnected = true;
      this.reconnecting = false;
      setTimeout(() => {
        this.reconnected = false;
      }, 10000);
      return ReconnectMsg.RECONNECTED;
    }

    this.reconnecting = false;
    this.reconnectTries++;
    setTimeout(() => {
      this.handleWsDisconnect();
    }, this.reconnectTries * 1000);

    return ReconnectMsg.FAIL;
  }

  public async wsReconnect(): Promise<boolean> {
    const { logger } = this.config;
    logger.debug('Attempting WS Reconnect.');
    try {
      const endpoint = this.endpoints[this.reconnectTries % this.endpoints.length];
      this.config.web3 = W3Util.getWeb3FromProviderUrl(endpoint);

      this.config.util = new W3Util(this.config.web3);
      this.scanner.util = this.config.util;
      if (await this.config.util.isWatchingEnabled()) {
        return true;
      } else {
        throw new Error('Invalid endpoint! eth_getFilterLogs is not enabled.');
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
