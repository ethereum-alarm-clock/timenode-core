import BigNumber from 'bignumber.js';
import Config from '../Config';
import { isExecuted, isTransactionStatusSuccessful } from './Helpers';
import hasPending from './Pending';
import W3Util from '../Util';

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(address.length - 5, address.length)}`;
}

export default class Actions {
  public config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  public async claim(txRequest: any): Promise<any> {
    const requiredDeposit = txRequest.requiredDeposit;
    // TODO make this a constant
    const claimData = txRequest.claimData;

    // Gas needed ~ 89k, this provides a buffer... just in case
    const gasEstimate = 120000;

    const opts = {
      to: txRequest.address,
      value: requiredDeposit,
      gas: gasEstimate,
      gasPrice: await this.config.util.networkGasPrice(),
      data: claimData
    };

    if (await hasPending(this.config, txRequest)) {
      return {
        ignore: true
      };
    }

    if (this.config.wallet.isNextAccountFree()) {
      try {
        // this.config.logger.debug(`[${txRequest.address}] Sending claim transactions with opts: ${JSON.stringify(opts)}`);
        const { receipt, from, ignore } = await this.config.wallet.sendFromNext(opts);
        // this.config.logger.debug(`[${txRequest.address}] Received receipt: ${JSON.stringify(receipt)}\n And from: ${from}`);

        if (ignore) {
          return;
        }

        if (isTransactionStatusSuccessful(receipt.status)) {
          await txRequest.refreshData();
          const cost = new BigNumber(receipt.gasUsed).mul(
            new BigNumber(txRequest.data.txData.gasPrice)
          );

          this.config.statsDb.updateClaimed(from, cost);

          return txRequest.isClaimed;
        }

        return false;
      } catch (error) {
        this.config.logger.debug(
          `Actions::claim(${shortenAddress(txRequest.address)})::sendFromIndex error: ${error}`
        );
      }
    } else {
      this.config.logger.debug(
        `Actions::claim(${shortenAddress(
          txRequest.address
        )})::Wallet with index 0 is not able to send tx.`
      );
    }

    //TODO get transaction object from txHash
  }

  public async execute(txRequest: any): Promise<any> {
    const gasToExecute = txRequest.callGas
      .add(180000)
      .div(64)
      .times(65)
      .round();
    // TODO Check that the gasToExecue < gasLimit of latest block w/ some margin

    // TODO make this a constant
    const executeData = txRequest.executeData;

    const claimIndex = this.config.wallet.getAddresses().indexOf(txRequest.claimedBy);
    this.config.logger.debug(`Claim Index ${claimIndex}`);

    const opts = {
      to: txRequest.address,
      value: 0,
      gas: gasToExecute,
      gasPrice: txRequest.gasPrice,
      data: executeData
    };

    this.config.logger.debug(`Opts: ${JSON.stringify(opts)}`);

    if (await hasPending(this.config, txRequest)) {
      return {
        ignore: true
      };
    }

    if (claimIndex !== -1) {
      const { receipt, from, ignore } = await this.config.wallet.sendFromIndex(claimIndex, opts);

      if (ignore) {
        return;
      }

      if (isTransactionStatusSuccessful(receipt.status)) {
        if (isExecuted(receipt)) {
          await txRequest.refreshData();

          const data = receipt.logs[0].data;
          const bounty = this.config.web3.toDecimal(data.slice(0, 66));

          this.config.statsDb.updateExecuted(from, bounty, new BigNumber(0));
        }

        const cost = new BigNumber(receipt.gasUsed).mul(
          new BigNumber(txRequest.data.txData.gasPrice)
        );
        this.config.statsDb.updateExecuted(from, new BigNumber(0), cost);

        return txRequest.wasSuccessful;
      }

      return false;
    }

    if (this.config.wallet.isNextAccountFree()) {
      const { receipt, from, ignore } = await this.config.wallet.sendFromNext(opts);

      if (ignore) {
        return;
      }

      if (isTransactionStatusSuccessful(receipt.status)) {
        if (isExecuted(receipt)) {
          await txRequest.refreshData();

          const data = receipt.logs[0].data;
          const bounty = this.config.web3.toDecimal(data.slice(0, 66));

          this.config.statsDb.updateExecuted(from, bounty, new BigNumber(0));
        }

        const cost = new BigNumber(receipt.gasUsed).mul(
          new BigNumber(txRequest.data.txData.gasPrice)
        );
        this.config.statsDb.updateExecuted(from, new BigNumber(0), cost);

        return txRequest.wasSuccessful;
      }

      return false;
    } else {
      this.config.logger.debug('Actions.execute : No available wallet to send a transaction.');
    }
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
        const { receipt, from, ignore } = await this.config.wallet.sendFromIndex(ownerIndex, opts);
        if (ignore) {
          return;
        }
      } else {
        if (gasCostToCancel.greaterThan(txRequestBalance)) {
          // The txRequest doesn't have high enough balance to compensate.
          // It's now considered dust.
          return true;
        }
        const { receipt, from, ignore } = await this.config.wallet.sendFromNext(opts);
        if (ignore) {
          return;
        }
      }

      //TODO get tx Obj from hash
    }
  }
}
