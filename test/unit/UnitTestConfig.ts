/* tslint:disable:no-unused-expressions */
import { expect, assert } from 'chai';
import Config from '../../src/Config';
import { DefaultLogger } from '../../src/Logger';
import { PRIVATE_KEY, providerUrl } from '../helpers';
import { BigNumber } from 'bignumber.js';

const WALLET_PASSWD = 'Wak9bk7DwZYL';
const WALLET_KEYSTORE = `{"version":3,"id":"90ff6d22-668b-492a-bc56-8b560fece46d","address":"487a54e1d033db51c8ee8c03edac2a0f8a6892c6","crypto":{"ciphertext":"115c232498a4f47d10de6c7148b8ebefdac44581b74475bba51675e83d7244dd","cipherparams":{"iv":"b53497a50161315e3fe4f33a9b74c22b"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"6d6e0329bf255c65c64e9e2face95227ab3221e8648635ac1b65a3c78ce25bbc","n":8192,"r":8,"p":1},"mac":"d771499de6091c8947f8ee9e5e91c3ea9b0b08ed90844c34f77ae2e33b40f40e"}}`;

describe('Config unit tests', () => {
  describe('constructor()', () => {
    it('throws an error when initiating without required params', () => {
      expect(() => new Config({ providerUrl: null })).to.throw();
    });

    it('check all default values are set when empty config', () => {
      const config = new Config({ providerUrl });

      assert.isTrue(config.autostart);
      assert.isFalse(config.claiming);
      assert.equal(config.ms, 4000);
      assert.equal(config.scanSpread, 50);
      assert.isFalse(config.walletStoresAsPrivateKeys);
      assert.isUndefined(config.client);
      expect(config.logger).to.exist; // tslint:disable-line no-unused-expression
      assert.isNull(config.wallet);
      assert.equal(config.economicStrategy.maxDeposit, Config.DEFAULT_ECONOMIC_STRATEGY.maxDeposit);
      assert.equal(config.economicStrategy.minBalance, Config.DEFAULT_ECONOMIC_STRATEGY.minBalance);
      assert.equal(
        config.economicStrategy.minProfitability,
        Config.DEFAULT_ECONOMIC_STRATEGY.minProfitability
      );
      assert.equal(
        config.economicStrategy.maxGasSubsidy,
        Config.DEFAULT_ECONOMIC_STRATEGY.maxGasSubsidy
      );
    });

    it('Detect if config client is set', () => {
      const config = new Config({ providerUrl });
      expect(config.clientSet()).to.be.false; // tslint:disable-line no-unused-expression
    });

    it('Detect when config client is set', async () => {
      const config = new Config({ providerUrl });
      expect(config.clientSet()).to.be.false; // tslint:disable-line no-unused-expression
      await config.awaitClientSet();
      expect(config.clientSet()).to.be.true; // tslint:disable-line no-unused-expression
    });

    it('Detects correct config client is set', async () => {
      const clients = ['geth', 'parity', 'unknown'];
      const found: any = [];
      const methods = {
        geth: 'txpool_content',
        parity: 'parity_pendingTransactions',
        unknown: ''
      };

      const Web3 = (client: string) => {
        return {
          currentProvider: {
            sendAsync: (payload: any, callback: (err: any, res: any) => void) => {
              console.log('inAsync', methods[client]);
              if (payload.method === methods[client]) {
                callback(null, {});
              } else {
                const err = new Error('Method does not exist');
                callback(err, { error: err });
              }
            }
          }
        };
      };

      await Promise.all(
        clients.map(async (client: string) => {
          const config = new Config({ providerUrl, disableDetection: true });
          config.web3 = Web3(client);
          config.getConnectedClient();
          await config.awaitClientSet();
          found.push(config.client);
        })
      );

      expect(found).to.deep.equal(clients);
    });

    it('check all values are set when added to config object', () => {
      const decimals = 1000000000000000000;
      const economicStrategy = {
        maxDeposit: new BigNumber(1 * decimals),
        minBalance: new BigNumber(5 * decimals),
        minProfitability: new BigNumber(0.01 * decimals),
        maxGasSubsidy: 200
      };

      const config = new Config({
        providerUrl,
        autostart: false,
        claiming: true,
        economicStrategy,
        ms: 10000,
        scanSpread: 100,
        walletStoresAsPrivateKeys: true,
        client: 'parity',
        logger: new DefaultLogger(),
        walletStores: [PRIVATE_KEY]
      });

      assert.isFalse(config.autostart);
      assert.isTrue(config.claiming);
      assert.equal(config.ms, 10000);
      assert.equal(config.scanSpread, 100);
      assert.isTrue(config.walletStoresAsPrivateKeys);
      assert.isNotNull(config.client);
      expect(config.logger).to.exist; // tslint:disable-line no-unused-expression
      assert.equal(config.wallet.getAccounts().length, 1);
      assert.equal(config.economicStrategy, economicStrategy);
    });

    it('wallet decrypted when using a keystore string', () => {
      const config = new Config({
        providerUrl,
        walletStores: [WALLET_KEYSTORE],
        password: WALLET_PASSWD
      });

      assert.equal(config.wallet.getAccounts().length, 1);
    });

    it('wallet decrypted when using a keystore object', () => {
      const config = new Config({
        providerUrl,
        walletStores: [JSON.parse(WALLET_KEYSTORE)],
        password: WALLET_PASSWD
      });

      assert.equal(config.wallet.getAccounts().length, 1);
    });

    it('throws an error when using a keystore without a password', () => {
      expect(
        () =>
          new Config({
            providerUrl,
            walletStores: [WALLET_KEYSTORE]
          })
      ).to.throw();
    });
  });
});
