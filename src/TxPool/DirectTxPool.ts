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
  private static ClientIdFilter = [
    'go1.5',
    'go1.6',
    'go1.7',
    'quorum',
    'pirl',
    'ubiq',
    'gmc',
    'gwhale',
    'prichain'
  ];
  private static ExecuteData = '0x61461954';
  private static ClaimData = '0x4e71d92d';

  public pool: Map<string, ITxPoolTxDetails> = new Map<string, ITxPoolTxDetails>();
  private isRunning: boolean = false;
  private web3: Web3;
  private privateKey: Buffer;
  private logger: ILogger;

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
    if (!this.isRunning && chainId === Networks.Mainnet) {
      this.startListening();
    }
  }
  // tslint:disable-next-line:no-empty
  public async stop() {}

  private get bootNodes() {
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
  }

  private bootstrap(bootNodes: any[]) {
    const dpt = new devp2p.DPT(this.privateKey, {
      refreshInterval: 30000,
      endpoint: {
        address: '0.0.0.0',
        udpPort: null,
        tcpPort: null
      }
    });

    bootNodes.forEach((bootNode: any) => {
      dpt.bootstrap(bootNode);
    });

    return dpt;
  }

  private register(dpt: any) {
    return new devp2p.RLPx(this.privateKey, {
      dpt,
      maxPeers: 25,
      capabilities: [devp2p.ETH.eth63, devp2p.ETH.eth62],
      remoteClientIdFilter: DirectTxPool.ClientIdFilter,
      listenPort: null
    });
  }

  private sendStatus(eth: any) {
    eth.sendStatus({
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
    });
  }

  private peerAdded(peer: any, rlpx: any) {
    const totalPeers = rlpx.getPeers().length;

    this.logger.debug(`[p2p] Peer added ${this.getPeerAddress(peer)} total peers: ${totalPeers}`);

    const eth = peer.getProtocols()[0];

    this.sendStatus(eth);

    eth.on('message', async (code: any, payload: any[]) => {
      if (code === devp2p.ETH.MESSAGE_CODES.TX) {
        this.onTransaction(payload);
      }
    });
  }

  private peerRemoved(peer: any, reasonCode: any, disconnectWe: any, rlpx: any) {
    const who = disconnectWe ? 'we disconnect' : 'peer disconnect';
    const totalPeers = rlpx.getPeers().length;

    this.logger.debug(
      `[p2p] Peer removed: ${this.getPeerAddress(
        peer
      )} - ${who}, reason: ${peer.getDisconnectPrefix(reasonCode)} (${String(
        reasonCode
      )}) total peers: ${totalPeers}`
    );
  }

  private getPeerAddress(peer: any) {
    return `${peer._socket.remoteAddress}:${peer._socket.remotePort}`;
  }

  private decodeOperation(tx: EthereumTx): Operation {
    const data = tx.data.toString('hex');
    let result = null;

    if (data.startsWith(DirectTxPool.ClaimData)) {
      result = Operation.CLAIM;
    } else if (data.startsWith(DirectTxPool.ExecuteData)) {
      result = Operation.EXECUTE;
    }

    return result;
  }

  private onTransaction(payload: any[]) {
    for (const rawTx of payload) {
      const tx = new EthereumTx(rawTx);
      const hash = tx.hash().toString('hex');
      const operation = this.decodeOperation(tx);
      if (!this.pool.has(hash) && tx.validate(false) && operation) {
        this.logger.debug(`[p2p] Transaction discovered ${hash} to ${tx.to.toString('hex')}`);

        this.pool.set(hash, {
          to: tx.to.toString('hex'),
          gasPrice: new BigNumber(tx.gasPrice.toString('hex')),
          operation,
          timestamp: new Date().getTime()
        });
      }
    }
  }

  private startListening() {
    const dpt = this.bootstrap(this.bootNodes);
    const rlpx = this.register(dpt);

    rlpx.on('peer:added', (peer: any) => {
      this.peerAdded(peer, rlpx);
    });

    rlpx.on('peer:removed', (peer: any, reasonCode: any, disconnectWe: any) => {
      this.peerRemoved(peer, reasonCode, disconnectWe, rlpx);
    });
  }
}
