import * as fs from 'fs';
import { Wallet } from '../../src/index';

export function createWallet(web3: any, num: number, filename: any, password: String) {
    const wallet = new Wallet(web3);
    wallet.create(num);

    console.log(`
New wallet created!
Accounts:
${wallet.getAddresses().join('\n')}
Saving encrypted file to ${filename}. Don't forget your password!`);
    
    const encryptedKeystore = wallet.encrypt(password, {});
    fs.writeFileSync(filename, JSON.stringify(encryptedKeystore));
    
    return encryptedKeystore;
};