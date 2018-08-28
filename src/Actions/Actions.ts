import BigNumber from 'bignumber.js';
import Config from '../Config';
import { isExecuted, isTransactionStatusSuccessful } from './Helpers';
import hasPending from './Pending';
import { IWalletReceipt } from '../Wallet';
import { getExecutionGasPrice } from '../EconomicStrategy';
import { ITxRequest, Address } from '../Types';
import { Status } from '../Enum';

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(address.length - 5, address.length)}`;
}

export default interface IActions {
  claim(txRequest: ITxRequest, nextAccount: Address): Promise<Status>;
  execute(txRequest: ITxRequest): Promise<Status>;
}

export default class Actions implements IActions {
  public config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  public async claim(txRequest: ITxRequest, nextAccount: Address): Promise<Status> {
    if (!this.config.claiming) {
      return Status.NOT_ENABLED;
    }
    //TODO: merge wallet ifs into 1 getWalletStatus or something
    if (this.config.wallet.hasPendingTransaction(txRequest.address)) {
      return Status.IN_PROGRESS;
    }
    if (!this.config.wallet.isAccountAbleToSendTx(nextAccount)) {
      return Status.ACCOUNT_BUSY;
    }
    if (await hasPending(this.config, txRequest, { type: 'claim', checkGasPrice: true })) {
      return Status.CLAIM_PENDING;
    }

    try {
      const opts = await this.getClaimingOpts(txRequest);
      this.config.logger.info(`Claiming...`, txRequest.address);

      const { receipt, from, status } = await this.config.wallet.sendFromAccount(nextAccount, opts);
      await this.accountClaimingCost(receipt, txRequest, opts, from);

      switch (status) {
        case Status.OK:
          this.config.cache.get(txRequest.address).claimedBy = from;
          return Status.SUCCESS;
        case Status.WALLET_BUSY:
          return Status.ACCOUNT_BUSY;
        case Status.IN_PROGRESS:
          return Status.IN_PROGRESS;
      }
    } catch (err) {
      this.config.logger.error(err);
    }

    return Status.CLAIM_FAILED;
  }

  public async execute(txRequest: ITxRequest): Promise<Status> {
    if (this.config.wallet.hasPendingTransaction(txRequest.address)) {
      return Status.IN_PROGRESS;
    }
    if (!(await this.config.wallet.isNextAccountFree())) {
      return Status.WALLET_BUSY;
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
        return Status.EXECUTE_PENDING;
      }

      const { receipt, from, status } = executionResult;

      switch (status) {
        case Status.OK:
          return await this.accountExecution(txRequest, receipt, opts, from);
      }
    } catch (err) {
      this.config.logger.error(err, txRequest.address);
    }

    return Status.EXECUTE_FAILED;
  }

  public async cleanup(): Promise<boolean> {
    throw Error('Not implemented according to latest EAC changes.');
  }

  private async accountExecution(
    txRequest: ITxRequest,
    receipt: any,
    opts: any,
    from: string
  ): Promise<Status> {
    let bounty = new BigNumber(0);
    let cost = new BigNumber(0);
    let status;
    const success = isExecuted(receipt);

    if (success) {
      await txRequest.refreshData();

      const data = receipt.logs[0].data;
      bounty = this.config.web3.toDecimal(data.slice(0, 66));

      this.config.cache.get(txRequest.address).wasCalled = true;
      status = Status.SUCCESS;
    } else {
      const gasUsed = new BigNumber(receipt.gasUsed);
      const gasPrice = new BigNumber(opts.gasPrice);
      cost = gasUsed.mul(gasPrice);
      status = Status.EXECUTE_FAILED;
    }

    this.config.statsDb.executed(from, txRequest.address, cost, bounty, success);
    return status;
  }

  private async hasPendingExecuteTransaction(txRequest: ITxRequest): Promise<boolean> {
    return hasPending(this.config, txRequest, {
      type: 'execute',
      checkGasPrice: true,
      minPrice: txRequest.gasPrice
    });
  }

  private async getClaimingOpts(txRequest: ITxRequest): Promise<any> {
    return {
      to: txRequest.address,
      value: txRequest.requiredDeposit,
      gas: 120000,
      gasPrice: await this.config.util.networkGasPrice(),
      data: txRequest.claimData
    };
  }

  private async getExecutionOpts(txRequest: ITxRequest): Promise<any> {
    const gas = this.config.util.calculateGasAmount(txRequest);
    const gasPrice = await getExecutionGasPrice(txRequest, this.config);

    return {
      to: txRequest.address,
      value: 0,
      gas,
      gasPrice,
      data: txRequest.executeData
    };
  }

  private async accountClaimingCost(receipt: any, txRequest: ITxRequest, opts: any, from: string) {
    if (receipt) {
      await txRequest.refreshData();
      const gasUsed = new BigNumber(receipt.gasUsed);
      const gasPrice = new BigNumber(opts.gasPrice);
      const cost = gasUsed.mul(gasPrice);
      const success = isTransactionStatusSuccessful(receipt.status);

      this.config.statsDb.claimed(from, txRequest.address, cost, success);
    }
  }
}
