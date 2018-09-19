import { AccountState, TransactionState } from '../../src/Wallet/AccountState';
import { assert } from 'chai';
import { Operation } from '../../src/Types/Operation';

describe('Account State Unit Tests', () => {
  describe('hasPending', () => {
    it('returns false when empty', () => {
      const accountState = new AccountState();
      const result = accountState.hasPending('0x0');

      assert.isFalse(result);
    });

    it('returns false when different account has pending', () => {
      const accountState = new AccountState();
      accountState.set('0x1', '0x0', Operation.CLAIM, TransactionState.PENDING);

      const result = accountState.hasPending('0x0');

      assert.isFalse(result);
    });

    it('returns true when account has pending transaction', () => {
      const accountState = new AccountState();
      const pendingAccount = '0x1';
      accountState.set(pendingAccount, '0x0', Operation.CLAIM, TransactionState.PENDING);

      const result = accountState.hasPending(pendingAccount);

      assert.isTrue(result);
    });
  });

  describe('isSent', () => {
    it('returns false when empty', () => {
      const accountState = new AccountState();
      const tx = '0x0';

      const result = accountState.isSent(tx, Operation.CLAIM);

      assert.isFalse(result);
    });

    it('returns false when no sent', () => {
      const accountState = new AccountState();
      const tx = '0x0';

      accountState.set('0x1', tx, Operation.CLAIM, TransactionState.PENDING);

      const result = accountState.isSent(tx, Operation.CLAIM);

      assert.isFalse(result);
    });

    it('returns true when sent', () => {
      const accountState = new AccountState();
      const tx = '0x0';
      accountState.set('0x1', tx, Operation.CLAIM, TransactionState.PENDING);
      accountState.set('0x1', tx, Operation.CLAIM, TransactionState.SENT);
      accountState.set('0x1', tx, Operation.EXECUTE, TransactionState.SENT);

      const result = accountState.isSent(tx, Operation.EXECUTE);

      assert.isTrue(result);
    });

    it('returns false when no sent and other are sent', () => {
      const accountState = new AccountState();
      const tx = '0x0';
      const tx2 = '0x1234';

      accountState.set('0x1', tx, Operation.EXECUTE, TransactionState.PENDING);
      accountState.set('0x1', tx, Operation.EXECUTE, TransactionState.CONFIRMED);

      accountState.set('0x1', tx2, Operation.EXECUTE, TransactionState.SENT);

      const result = accountState.isSent(tx, Operation.EXECUTE);

      assert.isFalse(result);
    });

    it('returns false when no other operation is sent', () => {
      const accountState = new AccountState();
      const tx = '0x0';

      accountState.set('0x1', tx, Operation.CLAIM, TransactionState.CONFIRMED);
      accountState.set('0x1', tx, Operation.EXECUTE, TransactionState.PENDING);

      const result = accountState.isSent(tx, Operation.EXECUTE);

      assert.isFalse(result);
    });
  });
});
