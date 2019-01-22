import BigNumber from 'bignumber.js';
import { randomBytes } from 'crypto';
import { bootstrapNodes } from 'ethereum-common';
import { devp2p } from 'ethereumjs-devp2p';
import EthereumTx = require('ethereumjs-tx');

import { ITxPool, ITxPoolTxDetails } from '.';
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

  public pool: Map<string, ITxPoolTxDetails>;
  private isRunning: boolean = false;
  private chainId: number;
  private privateKey: Buffer;

  constructor(chainId: number) {
    this.chainId = chainId;
    this.privateKey = randomBytes(32);
  }

  public running(): boolean {
    return this.isRunning;
  }

  public async start() {
    if (!this.isRunning) {
      this.startListening();
    }
  }
  public async stop() {
    throw new Error('Method not implemented.');
  }

  private get bootNodes() {
    return bootstrapNodes
      .filter((node: any) => {
        return node.chainId === this.chainId;
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
      networkId: this.chainId,
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
      this.peerAdded(peer);
    });
  }
}
