import BigNumber from 'bignumber.js';
import * as moment from 'moment';
import * as Bb from 'bluebird';

const MockTxRequest = async (web3: any, isBlock?: Boolean) => {
    const claimedBy = '0x0000000000000000000000000000000000000000';
    const requiredDeposit = new BigNumber(Math.pow(10, 16));

    const hoursLater = (number: number) => moment().add(number, 'hour').unix();
    const daysLater = (number: number) => moment().add(number, 'day').unix();

    const blocksLater = (number: number) => currentBlockNumber + number;

    const currentBlockNumber = await Bb.fromCallback((callback: any) =>
        web3.eth.getBlockNumber(callback)
    );

    return {
        'address': '0x74f8e3501b00bd219e864650f5625cd4f9272a75',
        'bounty': new BigNumber(Math.pow(10, 16)),
        claimedBy,
        'claimData': {
            claimedBy,
            requiredDeposit,
            'nonce': 156510 
        },
        'isClaimed': false,
        requiredDeposit,
        'temporalUnit': 1,
        'currentBlockNumber': new BigNumber(currentBlockNumber),
        'claimWindowStart': new BigNumber(isBlock ? blocksLater(100) : hoursLater(1)),
        'windowStart': new BigNumber(isBlock ? blocksLater(300) : daysLater(1)),
        'executionWindowEnd': new BigNumber(isBlock ? blocksLater(500) : daysLater(2)),
        'freezePeriod': new BigNumber(isBlock ? 255 : 3600), // ~1h
        'receipt': {},
        get claimWindowEnd() {
            return this.windowStart.minus(this.freezePeriod);
        },
        get freezePeriodEnd() {
            return this.claimWindowEnd.plus(this.freezePeriod)
        },
        claimPaymentModifier: function () {
            return new BigNumber(100);
        },
        isClaimedBy: function (address: string) {
            return this.claimedBy === address;
        },
        
        beforeClaimWindow: function() {
            return this.claimWindowStart.greaterThan(this.now());
        },
        inClaimWindow: function() {
            return this.claimWindowStart.lessThanOrEqualTo(this.now());
        },
        inFreezePeriod: function() {
            const now = this.now();
            return (
                this.claimWindowEnd.lessThanOrEqualTo(now) &&
                this.freezePeriodEnd.greaterThan(now)
            );
        },
        inExecutionWindow: function() {
            const now = this.now();
            return (
                this.windowStart.lessThanOrEqualTo(now) &&
                this.executionWindowEnd.greaterThanOrEqualTo(now)
            );
        },
        now: function() {
            return isBlock ? this.currentBlockNumber : moment().unix();
        }
    };
}

export { MockTxRequest };