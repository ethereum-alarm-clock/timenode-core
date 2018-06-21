import BigNumber from 'bignumber.js';
import * as moment from 'moment';
import * as Bb from 'bluebird';

const mockReceipt = {};
const requiredDeposit = new BigNumber(Math.pow(10, 16));
const address = '0x74f8e3501b00bd219e864650f5625cd4f9272a75';
const claimedBy = '0x0000000000000000000000000000000000000000';
const nonce = 156510;

const MockTxRequestBlock = async (web3: any) => {
    const currentBlockNumber = await Bb.fromCallback((callback: any) =>
        web3.eth.getBlockNumber(callback)
    );

    return {
        address,
        claimedBy,
        'claimData': {
            claimedBy,
            requiredDeposit,
            nonce 
        },
        requiredDeposit,
        'temporalUnit': 1,
        'currentBlockNumber': new BigNumber(currentBlockNumber),
        'claimWindowStart': new BigNumber(currentBlockNumber + 100),
        'executionWindowEnd': new BigNumber(currentBlockNumber + 500),
        'receipt': mockReceipt,
        isClaimedBy: function (address: string) {
            return this.claimedBy === address;
        },
        beforeClaimWindow: function () {
            return this.claimWindowStart.greaterThan(this.now());
        },
        now: function () {
            return this.currentBlockNumber;
        }
    };
}

const MockTxRequestTimestamp = () => {
    const oneHourLater = moment().add(1, 'hour').unix();
    const oneWeekAfter = moment().add(1, 'week').unix();

    return {
        address,
        claimedBy,
        'claimData': {
            claimedBy,
            requiredDeposit,
            'nonce': nonce + 1
        },
        requiredDeposit,
        'temporalUnit': 2,
        'claimWindowStart': new BigNumber(oneHourLater),
        'executionWindowEnd': new BigNumber(oneWeekAfter),
        'receipt': mockReceipt,
        isClaimedBy: function (address: string) {
            return this.claimedBy === address;
        },
        beforeClaimWindow: function () {
            return this.claimWindowStart.greaterThan(this.now());
        },
        now: function () {
            return moment().unix();
        }
    };
}

export { MockTxRequestBlock, MockTxRequestTimestamp };