import TimeNode from '../TimeNode';
import { ReconnectMsg } from '../Enum';
import W3Util from '../Util';

declare const setTimeout: any;

export default class WsReconnect {
  private timenode: TimeNode;
  private reconnectTries: number = 0;
  private reconnecting: boolean = false;
  private reconnected: boolean = false;

  constructor(timenode: TimeNode) {
    this.timenode = timenode;
  }

  public setup(): void {
    const {
      logger,
      web3: { currentProvider }
    } = this.timenode.config;

    currentProvider.on('error', (err: any) => {
      logger.debug(`[WS ERROR] ${err}`);
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

  private async handleWsDisconnect(): Promise<ReconnectMsg> {
    if (this.reconnected) {
      return ReconnectMsg.ALREADY_RECONNECTED;
    }
    if (this.reconnectTries >= this.timenode.config.maxRetries) {
      this.timenode.stopScanning();
      return ReconnectMsg.MAX_ATTEMPTS;
    }
    if (this.reconnecting) {
      return ReconnectMsg.RECONNECTING;
    }

    // Try to reconnect.
    this.reconnecting = true;
    if (await this.wsReconnect()) {
      await this.timenode.startScanning();
      this.reconnectTries = 0;
      this.setup();
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

  private async wsReconnect(): Promise<boolean> {
    const {
      config: { logger, providerUrls }
    } = this.timenode;
    logger.debug('Attempting WS Reconnect.');
    try {
      const providerUrl = providerUrls[this.reconnectTries % providerUrls.length];
      const nextWeb3 = W3Util.getWeb3FromProviderUrl(providerUrl);
      this.timenode.config.web3 = nextWeb3;
      this.timenode.scanner.util = this.timenode.config.util = new W3Util(nextWeb3);
      if (await this.timenode.config.util.isWatchingEnabled()) {
        return true;
      } else {
        throw new Error('Invalid providerUrl! eth_getFilterLogs not enabled.');
      }
    } catch (err) {
      logger.error(err.message);
      logger.info(`Reconnect tries: ${this.reconnectTries}`);
      return false;
    }
  }
}
