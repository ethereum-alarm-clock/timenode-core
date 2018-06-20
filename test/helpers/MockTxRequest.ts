import BigNumber from 'bignumber.js';

const MockTxRequest = () => {

    const mockReceipt = {};
    const requiredDeposit = new BigNumber(Math.pow(10, 16));

    return {
        'address': '0x74f8e3501b00bd219e864650f5625cd4f9272a75',
        'claimData': {
            'claimedBy': '0x0000000000000000000000000000000000000000',
            requiredDeposit,
            'nonce': 156510
        },
        requiredDeposit
    };
}

export { MockTxRequest };