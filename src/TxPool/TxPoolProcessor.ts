import { ILogger, DefaultLogger } from '../Logger';
import { CLAIMED_EVENT, EXECUTED_EVENT } from '../Actions/Helpers';
import { Operation } from '../Types/Operation';
import { ITxPoolTxDetails } from '.';
import { Util } from '@ethereum-alarm-clock/lib';
import BigNumber from 'bignumber.js';
import { Log } from 'web3/types';

export default class TxPoolProcessor {
  private logger: ILogger;
  private util: Util;

  constructor(util: Util, logger: ILogger = new DefaultLogger()) {
    this.logger = logger;
    this.util = util;
  }

  public async process(transaction: Log, pool: Map<string, ITxPoolTxDetails>) {
    if (!this.hasKnownEvents(transaction)) {
      throw new Error('Unknown events');
    }

    this.logger.debug(
      `Pending transaction discovered ${JSON.stringify(transaction)}`,
      transaction.address
    );

    const { transactionHash } = transaction;
    const operation =
      transaction.topics.indexOf(CLAIMED_EVENT) > -1 ? Operation.CLAIM : Operation.EXECUTE;

    if (!pool.has(transactionHash)) {
      await this.setTxPoolDetails(pool, transactionHash, operation);
    }
  }

  private hasKnownEvents(transaction: Log): boolean {
    return (
      transaction.topics.indexOf(CLAIMED_EVENT) > -1 ||
      transaction.topics.indexOf(EXECUTED_EVENT) > -1
    );
  }

  private async setTxPoolDetails(
    pool: Map<string, ITxPoolTxDetails>,
    transactionHash: string,
    operation: Operation
  ) {
    try {
      const poolDetails = await this.getTxPoolDetails(transactionHash, operation);

      pool.set(transactionHash, poolDetails);
    } catch (e) {
      this.logger.error(e);
    }
  }

  private async getTxPoolDetails(
    transactionHash: string,
    operation: Operation
  ): Promise<ITxPoolTxDetails> {
    const tx = await this.util.getTransaction(transactionHash);
    return {
      to: tx.to,
      gasPrice: new BigNumber(tx.gasPrice),
      timestamp: new Date().getTime(),
      operation
    };
  }
}
