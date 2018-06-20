import { expect } from 'chai';
import {
    createWallet,
    createWalletKeystore,
    providerUrl
} from './helpers';
import * as Web3 from 'web3';

const provider = new Web3.providers.HttpProvider(providerUrl);
const web3 = new Web3(provider);

const filename = 'wallet.txt';
const password = 'password123';

describe('CreateWallet', () => {
    it('creates a new wallet', () => {
        const wallet = createWallet(web3, 1, filename, password);
        expect(wallet).to.exist;
    })

    it('creates a new encrypted wallet', () => {
        const encWallet = createWalletKeystore(web3, 1, filename, password);
        expect(encWallet).to.exist;
    })
})
