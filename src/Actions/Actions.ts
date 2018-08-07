import BigNumber from 'bignumber.js';
import Config from '../Config';
import { isExecuted, isTransactionStatusSuccessful } from './Helpers';
import hasPending from './Pending';
import { IWalletReceipt } from '../Wallet';
import { ExecuteStatus, ClaimStatus } from '../Enum';
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
    // Check if claiming is turned off.
    if (!this.config.claiming) {
      return ClaimStatus.NOT_ENABLED;
    }

    const opts = await this.getClaimingOpts(txRequest);

    if (await hasPending(this.config, txRequest, { type: 'claim' })) {
      return ClaimStatus.PENDING;
    }

    let claimingError;

    try {
      const { receipt, from, error } = await this.config.wallet.sendFromNext(opts);

      if (!error && isTransactionStatusSuccessful(receipt.status)) {
        await txRequest.refreshData();

        const gasUsed = new BigNumber(receipt.gasUsed);
        const gasPrice = new BigNumber(txRequest.data.txData.gasPrice);
        const cost = gasUsed.mul(gasPrice);

        this.config.cache.get(txRequest.address).claimedBy = from;
        this.config.statsDb.updateClaimed(from, cost);

        return ClaimStatus.SUCCESS;
      } else if (error == TxSendErrors.SENDING_IN_PROGRESS) {
        return ClaimStatus.PENDING;
      }

      claimingError = error;
    } catch (err) {
      claimingError = err;
    }

    if (this.config.cache.has(txRequest.address)) {
      this.config.cache.get(txRequest.address).claimingFailed = true;
    } else {
      this.config.cache.set(txRequest.address, {
        claimedBy: null,
        claimingFailed: true,
        wasCalled: false,
        windowStart: null
      });
    }

    this.config.logger.error(`[${txRequest.address}] error: ${claimingError}`);

    return ClaimStatus.FAILED;
  }

  public async execute(txRequest: any): Promise<any> {
    if (
      await hasPending(this.config, txRequest, {
        type: 'execute',
        exactPrice: txRequest.gasPrice
      })
    ) {
      return ExecuteStatus.PENDING;
    }

    const handleTransactionReturn = async (
      walletReceipt: IWalletReceipt
    ): Promise<ExecuteStatus> => {
      const { receipt, from, error } = walletReceipt;

      if (error) {
        this.config.logger.debug(`Actions.execute: ${ExecuteStatus.FAILED}`);
        return ExecuteStatus.FAILED;
      }

      if (isTransactionStatusSuccessful(receipt.status)) {
        let bounty = new BigNumber(0);
        let cost = new BigNumber(0);

        if (isExecuted(receipt)) {
          await txRequest.refreshData();

          const data = receipt.logs[0].data;
          bounty = this.config.web3.toDecimal(data.slice(0, 66));

          const cached = this.config.cache.get(txRequest.address);

          if (cached) {
            cached.wasCalled = true;
          }
        } else {
          // If not executed, must add the gas cost into cost. Otherwise, TimeNode was
          // reimbursed for gas.
          cost = new BigNumber(receipt.gasUsed).mul(new BigNumber(txRequest.data.txData.gasPrice));
        }

        this.config.statsDb.updateExecuted(from, bounty, cost);

        return ExecuteStatus.SUCCESS;
      }

      return ExecuteStatus.FAILED;
    };

    const opts = await this.getExecutionOpts(txRequest);

    const claimIndex = this.config.wallet.getAddresses().indexOf(txRequest.claimedBy);
    this.config.logger.debug(`Actions:execute: claiming account index=${claimIndex}`);

    const walletReceipt =
      claimIndex !== -1
        ? await this.config.wallet.sendFromIndex(claimIndex, opts)
        : await this.config.wallet.sendFromNext(opts);

    return await handleTransactionReturn(walletReceipt);
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
        const { error } = await this.config.wallet.sendFromIndex(ownerIndex, opts);
        if (error) {
          return;
        }
      } else {
        if (gasCostToCancel.greaterThan(txRequestBalance)) {
          // The txRequest doesn't have high enough balance to compensate.
          // It's now considered dust.
          return true;
        }
        const { error } = await this.config.wallet.sendFromNext(opts);
        if (error) {
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
    const gas = txRequest.callGas
      .add(180000)
      .div(64)
      .times(65)
      .round();

    return {
      to: txRequest.address,
      value: 0,
      gas,
      gasPrice: txRequest.gasPrice,
      data: txRequest.executeData
    };
  }
}
