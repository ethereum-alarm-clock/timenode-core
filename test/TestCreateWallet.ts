import { expect } from 'chai';
import { createWallet } from './helpers/createWallet';
import * as Web3 from 'web3';
import * as fs from 'fs';

describe('CreateWallet', () => {
    it('creates a new wallet', () => {
        const provider = new Web3.providers.HttpProvider('http://localhost:8545/');
        const web3 = new Web3(provider);

        const filename = 'wallet.txt';

        const wallet = createWallet(web3, 1, filename, 'password123');
        fs.unlinkSync(filename); // Delete the generated wallet
        expect(wallet).to.exist;
    })
})
