import { AccountState, TransactionState } from '../../src/Wallet/AccountState';
import { assert } from 'chai';

describe('Account State Unit Tests', () => {
  describe('hasPending', () => {
    it('returns false when empty', () => {
      const accountState = new AccountState();
      const result = accountState.hasPending('0x0');

      assert.isFalse(result);
    });

    it('returns false when different account has pending', () => {
      const accountState = new AccountState();
      accountState.set('0x1', '0x0', TransactionState.PENDING);

      const result = accountState.hasPending('0x0');

      assert.isFalse(result);
    });

    it('returns true when account has pending transaction', () => {
      const accountState = new AccountState();
      const pendingAccount = '0x1';
      accountState.set(pendingAccount, '0x0', TransactionState.PENDING);

      const result = accountState.hasPending(pendingAccount);

      assert.isTrue(result);
    });
  });

  describe('isConfirmed', () => {
    it('returns false when no confirmed', () => {
      const accountState = new AccountState();
      const tx = '0x0';
      accountState.set('0x1', tx, TransactionState.PENDING);

      const result = accountState.isConfirmed(tx);

      assert.isFalse(result);
    });

    it('returns true when confirmed', () => {
      const accountState = new AccountState();
      const tx = '0x0';
      accountState.set('0x1', tx, TransactionState.PENDING);
      accountState.set('0x1', tx, TransactionState.SENT);
      accountState.set('0x1', tx, TransactionState.CONFIRMED);

      const result = accountState.isConfirmed(tx);

      assert.isTrue(result);
    });

    it('returns false when no confirmed and other are confirmed', () => {
      const accountState = new AccountState();
      const tx = '0x0';
      const tx2 = '0x1234';

      accountState.set('0x1', tx, TransactionState.PENDING);
      accountState.set('0x1', tx, TransactionState.SENT);

      accountState.set('0x1', tx2, TransactionState.CONFIRMED);

      const result = accountState.isConfirmed(tx);

      assert.isFalse(result);
    });
  });
});
