import BigNumber from 'bignumber.js';
import * as moment from 'moment';
import * as Bb from 'bluebird';

const MockTxRequest = async (web3: any, isBlock?: Boolean) => {
    const mockReceipt = {};
    const requiredDeposit = new BigNumber(Math.pow(10, 16));
    const address = '0x74f8e3501b00bd219e864650f5625cd4f9272a75';
    const claimedBy = '0x0000000000000000000000000000000000000000';
    const nonce = 156510;
    const isClaimed = false;
    const bounty = new BigNumber(Math.pow(10, 16));
    const oneHourLater = moment().add(1, 'hour').unix();
    const oneWeekAfter = moment().add(1, 'week').unix();

    const currentBlockNumber = await Bb.fromCallback((callback: any) =>
        web3.eth.getBlockNumber(callback)
    );

    return {
        address,
        bounty,
        claimedBy,
        'claimData': {
            claimedBy,
            requiredDeposit,
            nonce 
        },
        isClaimed,
        requiredDeposit,
        'temporalUnit': 1,
        'currentBlockNumber': new BigNumber(currentBlockNumber),
        'claimWindowStart': new BigNumber(isBlock ? (currentBlockNumber + 100) : oneHourLater),
        'executionWindowEnd': new BigNumber(isBlock ? (currentBlockNumber + 500) : oneWeekAfter),
        'receipt': mockReceipt,
        isClaimedBy: function (address: string) {
            return this.claimedBy === address;
        },
        claimPaymentModifier: function () {
            return new BigNumber(100);
        },
        beforeClaimWindow: function () {
            return this.claimWindowStart.greaterThan(this.now());
        },
        inClaimWindow: function () {
            return this.claimWindowStart.lessThanOrEqualTo(this.now());
        },
        now: function () {
            return isBlock ? this.currentBlockNumber : moment().unix();
        }
    };
}

export { MockTxRequest };