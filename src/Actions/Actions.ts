import BigNumber from 'bignumber.js';
import Config from '../Config';
import { isExecuted, isAborted, getAbortedExecuteStatus } from './Helpers';
import hasPending from './Pending';
import { IWalletReceipt } from '../Wallet';
import { ExecuteStatus, ClaimStatus } from '../Enum';
import { getExecutionGasPrice } from '../EconomicStrategy';
import { TxSendErrors } from '../Enum/TxSendErrors';
import { ITxRequest, Address } from '../Types';
import { Ledger, ILedger } from './Ledger';
import ITransactionOptions from '../Types/ITransactionOptions';

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(address.length - 5, address.length)}`;
}

export default interface IActions {
  claim(txRequest: ITxRequest, nextAccount: Address): Promise<ClaimStatus>;
  execute(txRequest: ITxRequest): Promise<ExecuteStatus>;
}

export default class Actions implements IActions {
  public config: Config;
  private ledger: ILedger;

  constructor(config: Config) {
    this.config = config;
    this.ledger = new Ledger(config.statsDb);
  }

  public async claim(txRequest: ITxRequest, nextAccount: Address): Promise<ClaimStatus> {
    if (!this.config.claiming) {
      return ClaimStatus.NOT_ENABLED;
    }
    //TODO: merge wallet ifs into 1 getWalletStatus or something
    if (this.config.wallet.hasPendingTransaction(txRequest.address)) {
      return ClaimStatus.IN_PROGRESS;
    }
    if (!this.config.wallet.isAccountAbleToSendTx(nextAccount)) {
      return ClaimStatus.ACCOUNT_BUSY;
    }
    if (await hasPending(this.config, txRequest, { type: 'claim', checkGasPrice: true })) {
      return ClaimStatus.PENDING;
    }

    try {
      const opts = await this.getClaimingOpts(txRequest);
      this.config.logger.info(`Claiming...`, txRequest.address);

      const { receipt, from, status } = await this.config.wallet.sendFromAccount(nextAccount, opts);
      await this.ledger.accountClaiming(receipt, txRequest, opts, from);

      switch (status) {
        case TxSendErrors.OK:
          this.config.cache.get(txRequest.address).claimedBy = from;
          return ClaimStatus.SUCCESS;
        case TxSendErrors.WALLET_BUSY:
          return ClaimStatus.ACCOUNT_BUSY;
        case TxSendErrors.IN_PROGRESS:
          return ClaimStatus.IN_PROGRESS;
      }
    } catch (err) {
      this.config.logger.error(err);
    }

    return ClaimStatus.FAILED;
  }

  public async execute(txRequest: ITxRequest): Promise<ExecuteStatus> {
    if (this.config.wallet.hasPendingTransaction(txRequest.address)) {
      return ExecuteStatus.IN_PROGRESS;
    }
    if (!(await this.config.wallet.isNextAccountFree())) {
      return ExecuteStatus.WALLET_BUSY;
    }

    try {
      const opts = await this.getExecutionOpts(txRequest);
      const claimIndex = this.config.wallet.getAddresses().indexOf(txRequest.claimedBy);
      const wasClaimedByOurNode = claimIndex > -1;
      let executionResult: IWalletReceipt;

      if (wasClaimedByOurNode && txRequest.inReservedWindow()) {
        this.config.logger.debug(
          `Claimed by our node ${claimIndex} and inReservedWindow`,
          txRequest.address
        );
        this.config.logger.info(`Executing...`, txRequest.address);
        executionResult = await this.config.wallet.sendFromIndex(claimIndex, opts);
      } else if (!(await this.hasPendingExecuteTransaction(txRequest))) {
        this.config.logger.info(`Executing...`, txRequest.address);
        executionResult = await this.config.wallet.sendFromNext(opts);
      } else {
        return ExecuteStatus.PENDING;
      }

      const { receipt, from, status } = executionResult;

      switch (status) {
        case TxSendErrors.OK:
          await txRequest.refreshData();

          let executionStatus = ExecuteStatus.SUCCESS;
          const success = isExecuted(receipt);

          if (success) {
            this.config.cache.get(txRequest.address).wasCalled = true;
          } else if (isAborted(receipt)) {
            executionStatus = getAbortedExecuteStatus(receipt);
          } else {
            executionStatus = ExecuteStatus.FAILED;
          }

          this.ledger.accountExecution(txRequest, receipt, opts, from, success);

          return executionStatus;
        case TxSendErrors.WALLET_BUSY:
          return ExecuteStatus.WALLET_BUSY;
        case TxSendErrors.IN_PROGRESS:
          return ExecuteStatus.IN_PROGRESS;
      }
    } catch (err) {
      this.config.logger.error(err, txRequest.address);
    }

    return ExecuteStatus.FAILED;
  }

  public async cleanup(): Promise<boolean> {
    throw Error('Not implemented according to latest EAC changes.');
  }

  private async hasPendingExecuteTransaction(txRequest: ITxRequest): Promise<boolean> {
    return hasPending(this.config, txRequest, {
      type: 'execute',
      checkGasPrice: true,
      minPrice: txRequest.gasPrice
    });
  }

  private async getClaimingOpts(txRequest: ITxRequest): Promise<ITransactionOptions> {
    return {
      to: txRequest.address,
      value: txRequest.requiredDeposit,
      gas: 120000,
      gasPrice: await this.config.util.networkGasPrice(),
      data: txRequest.claimData
    };
  }

  private async getExecutionOpts(txRequest: ITxRequest): Promise<ITransactionOptions> {
    const gas = this.config.util.calculateGasAmount(txRequest);
    const gasPrice = await getExecutionGasPrice(txRequest, this.config);

    return {
      to: txRequest.address,
      value: new BigNumber(0),
      gas: gas.toNumber(),
      gasPrice,
      data: txRequest.executeData
    };
  }
}
