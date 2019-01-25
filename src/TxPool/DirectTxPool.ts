import { Networks } from '@ethereum-alarm-clock/lib';
import BigNumber from 'bignumber.js';
import { randomBytes } from 'crypto';
import { bootstrapNodes } from 'ethereum-common';
import * as devp2p from 'ethereumjs-devp2p';
import EthereumTx = require('ethereumjs-tx');
import Web3 = require('web3');

import { ITxPool, ITxPoolTxDetails } from '.';
import { DefaultLogger, ILogger } from '../Logger';
import { Operation } from '../Types/Operation';

export default class DirectTxPool implements ITxPool {
  private static ExecuteData = '61461954';
  private static ClaimData = '4e71d92d';
  private static MaxPeers = 25;
  private static NetworkStatusMessage = new Map<Networks, any>([
    [
      Networks.Mainnet,
      {
        networkId: Networks.Mainnet,
        td: devp2p._util.int2buffer(17179869184), // total difficulty in genesis block
        bestHash: Buffer.from(
          'd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
          'hex'
        ),
        genesisHash: Buffer.from(
          'd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
          'hex'
        )
      }
    ],
    [
      Networks.Kovan,
      {
        networkId: Networks.Kovan,
        td: devp2p._util.int2buffer(131072), // total difficulty in genesis block
        bestHash: Buffer.from(
          'a3c565fc15c7478862d50ccd6561e3c06b24cc509bf388941c25ea985ce32cb9',
          'hex'
        ),
        genesisHash: Buffer.from(
          'a3c565fc15c7478862d50ccd6561e3c06b24cc509bf388941c25ea985ce32cb9',
          'hex'
        )
      }
    ]
  ]);

  public pool: Map<string, ITxPoolTxDetails> = new Map<string, ITxPoolTxDetails>();
  private isRunning: boolean = false;
  private web3: Web3;
  private privateKey: Buffer;
  private logger: ILogger;
  private chainId: Networks;

  private dpt: any;
  private rlpx: any;

  private status: NodeJS.Timeout;

  constructor(web3: Web3, logger: ILogger = new DefaultLogger()) {
    this.web3 = web3;
    this.privateKey = randomBytes(32);
    this.logger = logger;
  }

  public running(): boolean {
    return this.isRunning;
  }

  public async start() {
    const chainId = await this.web3.eth.net.getId();

    if (!this.isRunning && this.isChainSupported(chainId)) {
      this.chainId = chainId;
      this.startListening();
    }
  }
  // tslint:disable-next-line:no-empty
  public async stop() {
    clearInterval(this.status);
  }

  private isChainSupported(chainId: number) {
    return chainId === Networks.Mainnet || chainId === Networks.Kovan;
  }

  private get bootNodes() {
    if (this.chainId === Networks.Mainnet) {
      return bootstrapNodes
        .filter((node: any) => {
          return node.chainId === Networks.Mainnet;
        })
        .map((node: any) => {
          return {
            address: node.ip,
            udpPort: node.port,
            tcpPort: node.port
          };
        });
    } else if (this.chainId === Networks.Kovan) {
      return [
        {
          address: '40.71.221.215',
          udpPort: 30303,
          tcpPort: 30303
        },
        {
          address: '52.166.117.77',
          udpPort: 30303,
          tcpPort: 30303
        },
        {
          address: '52.165.239.18',
          udpPort: 30303,
          tcpPort: 30303
        },
        {
          address: '52.243.47.56',
          udpPort: 30303,
          tcpPort: 30303
        },
        {
          address: '40.68.248.100',
          udpPort: 30303,
          tcpPort: 30303
        }
      ];
    }
  }

  private bootstrap(bootNodes: any[]) {
    this.logger.debug(`[p2p] Bootstraping with ${bootNodes.length} nodes`);

    this.dpt = new devp2p.DPT(this.privateKey, {
      refreshInterval: 30000,
      endpoint: {
        address: '0.0.0.0',
        udpPort: null,
        tcpPort: null
      }
    });

    bootNodes.forEach((bootNode: any) => {
      this.dpt
        .bootstrap(bootNode)
        .catch((e: Error) => this.logger.debug(`[p2p] bootstrap error ${e.message}`));
    });

    clearInterval(this.status);
    this.status = setInterval(() => {
      const peersCount = this.dpt.getPeers().length;
      const openSlots = this.rlpx._getOpenSlots();
      const connected = DirectTxPool.MaxPeers - openSlots;

      this.logger.debug(
        `[p2p] Discovered ${peersCount} nodes, connected to ${connected}/${DirectTxPool.MaxPeers}`
      );
    }, 60 * 1000);
  }

  private register() {
    return new devp2p.RLPx(this.privateKey, {
      dpt: this.dpt,
      maxPeers: DirectTxPool.MaxPeers,
      capabilities: [devp2p.ETH.eth63],
      listenPort: null
    });
  }

  private async fetchLatestBlockHash(): Promise<Buffer> {
    const latestBlock = await this.web3.eth.getBlock('latest');
    return Buffer.from(latestBlock.hash.substring(2), 'hex');
  }

  private async sendStatus(eth: any) {
    const message = DirectTxPool.NetworkStatusMessage.get(this.chainId);

    if (message) {
      message.bestHash = await this.fetchLatestBlockHash();
      try {
        eth.sendStatus(message);
      } catch (error) {
        this.logger.debug(`[p2p] Send status error ${error.message}`);
      }
    } else {
      throw new Error(`[p2p] Status message not defined for ${this.chainId}`);
    }
  }

  private peerAdded(peer: any) {
    const eth = peer.getProtocols()[0];

    this.sendStatus(eth);

    eth.on('message', async (code: any, payload: any[]) => {
      if (code === devp2p.ETH.MESSAGE_CODES.TX) {
        this.onTransaction(payload);
      }
    });
  }

  private decodeOperation(tx: EthereumTx): Operation {
    const data = tx.data.toString('hex');
    let result = Operation.OTHER;

    if (data.startsWith(DirectTxPool.ClaimData)) {
      result = Operation.CLAIM;
    } else if (data.startsWith(DirectTxPool.ExecuteData)) {
      result = Operation.EXECUTE;
    }

    return result;
  }

  private onTransaction(payload: any[]) {
    this.logger.debug(`[p2p] Received ${payload.length} transactions`);
    try {
      for (const rawTx of payload) {
        const tx = new EthereumTx(rawTx);
        const hash = tx.hash().toString('hex');
        const operation = this.decodeOperation(tx);
        if (!this.pool.has(hash) && tx.validate(false) && operation !== Operation.OTHER) {
          this.logger.debug(`[p2p] Transaction discovered ${hash} to ${tx.to.toString('hex')}`);

          const to = `0x${tx.to.toString('hex')}`;
          const gasPrice = new BigNumber(`0x${tx.gasPrice.toString('hex')}`);

          this.pool.set(hash, {
            to,
            gasPrice,
            operation,
            timestamp: new Date().getTime()
          });
        }
      }
    } catch (e) {
      this.logger.error(`[p2p] onTransaction error ${e.message}`);
    }
  }

  private startListening() {
    this.bootstrap(this.bootNodes);
    this.rlpx = this.register();

    this.rlpx.on('peer:added', (peer: any) => {
      this.peerAdded(peer);
    });

    this.rlpx.on('error', (error: any) => this.logger.debug(`[p2p] rlpx error ${error.message}`));
  }
}
