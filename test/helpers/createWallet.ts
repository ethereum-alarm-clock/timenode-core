import { Wallet } from '../../src/index';

export function createWalletKeystore(web3: any, num: number, filename: any, password: string) {
  const wallet = new Wallet(web3);
  wallet.create(num);

  const encryptedKeystore = wallet.encrypt(password, {});
  return encryptedKeystore;
}

export function createWallet(web3: any, num: number, filename: any, password: string) {
  const wallet = new Wallet(web3);
  wallet.create(num);
  return wallet;
}
