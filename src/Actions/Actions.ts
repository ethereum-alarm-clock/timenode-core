import BigNumber from 'bignumber.js';
import Config from '../Config';
import { isExecuted, isTransactionStatusSuccessful } from './Helpers';
import hasPending from './Pending';
import { IWalletReceipt } from '../Wallet';
import { ExecuteStatus, ClaimStatus } from '../Enum';
import { getExecutionGasPrice } from '../EconomicStrategy';
import { TxSendErrors } from '../Enum/TxSendErrors';

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(address.length - 5, address.length)}`;
}

export default class Actions {
  public config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  public async claim(txRequest: any): Promise<ClaimStatus> {
    if (!this.config.claiming) {
      return ClaimStatus.NOT_ENABLED;
    }

    const opts = await this.getClaimingOpts(txRequest);

    if (await hasPending(this.config, txRequest, { type: 'claim' })) {
      return ClaimStatus.PENDING;
    }

    let claimingError;

    try {
      const { receipt, from, status } = await this.config.wallet.sendFromNext(opts);

      await this.accountClaimingCost(receipt, txRequest, opts, from);

      if (!status && isTransactionStatusSuccessful(receipt.status)) {
        //TODO: change this logic condition
        this.config.cache.get(txRequest.address).claimedBy = from;

        return ClaimStatus.SUCCESS;
      } else if (status === TxSendErrors.SENDING_IN_PROGRESS) {
        return ClaimStatus.IN_PROGRESS;
      }

      this.config.statsDb.addFailedClaim(from, txRequest.address);
      claimingError = status;
    } catch (err) {
      claimingError = err;
    }

    this.config.logger.error(`Error: ${claimingError}`, txRequest.address);

    return ClaimStatus.FAILED;
  }

  public async execute(txRequest: any): Promise<any> {
    if (
      await hasPending(this.config, txRequest, {
        type: 'execute',
        minPrice: txRequest.gasPrice
      })
    ) {
      return ExecuteStatus.PENDING;
    }

    const opts = await this.getExecutionOpts(txRequest);

    let executionError;

    try {
      const claimIndex = this.config.wallet.getAddresses().indexOf(txRequest.claimedBy);
      const { receipt, from, status } =
        claimIndex !== -1
          ? await this.config.wallet.sendFromIndex(claimIndex, opts)
          : await this.config.wallet.sendFromNext(opts);

      if (!status && isTransactionStatusSuccessful(receipt.status)) {
        let bounty = new BigNumber(0);
        let cost = new BigNumber(0);

        if (isExecuted(receipt)) {
          await txRequest.refreshData();

          const data = receipt.logs[0].data;
          bounty = this.config.web3.toDecimal(data.slice(0, 66));

          this.config.cache.get(txRequest.address).wasCalled = true;
        } else {
          // If not executed, must add the gas cost into cost. Otherwise, TimeNode was
          // reimbursed for gas.
          const gasUsed = new BigNumber(receipt.gasUsed);
          const gasPrice = new BigNumber(opts.gasPrice);
          cost = gasUsed.mul(gasPrice);
        }

        this.config.statsDb.updateExecuted(from, bounty, cost);

        return ExecuteStatus.SUCCESS;
      } else if (status === TxSendErrors.SENDING_IN_PROGRESS) {
        return ExecuteStatus.IN_PROGRESS;
      }

      executionError = status;
    } catch (err) {
      executionError = err;
    }

    this.config.logger.debug(`Error: ${executionError}`, txRequest.address);

    return ExecuteStatus.FAILED;
  }

  public async cleanup(txRequest: any): Promise<boolean> {
    throw Error('Not implemented according to latest EAC changes.');

    // Check if there is any ether left in a txRequest.
    const txRequestBalance = await txRequest.getBalance();

    if (txRequestBalance.equals(0)) {
      return true;
    }

    if (txRequest.isCancelled) {
      return true;
    } else {
      // Cancel it!
      const gasEstimate = await this.config.util.estimateGas({
        to: txRequest.address,
        data: txRequest.cancelData
      });

      // Get latest block gas price.
      const estGasPrice = await this.config.util.networkGasPrice();

      const gasCostToCancel = estGasPrice.times(gasEstimate);

      const opts = {
        to: txRequest.address,
        value: 0,
        gas: gasEstimate + 21000,
        gasPrice: estGasPrice,
        data: txRequest.cancelData // TODO make constant
      };

      // Check to see if any of our accounts is the owner.
      const ownerIndex = this.config.wallet.getAddresses().indexOf(txRequest.owner);
      if (ownerIndex !== -1) {
        const { status } = await this.config.wallet.sendFromIndex(ownerIndex, opts);
        if (status) {
          return;
        }
      } else {
        if (gasCostToCancel.greaterThan(txRequestBalance)) {
          // The txRequest doesn't have high enough balance to compensate.
          // It's now considered dust.
          return true;
        }
        const { status } = await this.config.wallet.sendFromNext(opts);
        if (status) {
          return;
        }
      }

      //TODO get tx Obj from hash
    }
  }

  private async getClaimingOpts(txRequest: any): Promise<any> {
    return {
      to: txRequest.address,
      value: txRequest.requiredDeposit,
      gas: 120000,
      gasPrice: await this.config.util.networkGasPrice(),
      data: txRequest.claimData
    };
  }

  private async getExecutionOpts(txRequest: any): Promise<any> {
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

  private async accountClaimingCost(receipt: any, txRequest: any, opts: any, from: string) {
    if (receipt) {
      await txRequest.refreshData();
      const gasUsed = new BigNumber(receipt.gasUsed);
      const gasPrice = new BigNumber(opts.gasPrice);
      const cost = gasUsed.mul(gasPrice);

      this.config.statsDb.updateClaimed(from, cost);
    }
  }
}
