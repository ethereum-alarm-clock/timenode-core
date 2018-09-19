import { Operation } from '../Types/Operation';

export enum TransactionState {
  ERROR,
  PENDING,
  SENT,
  CONFIRMED
}

export interface IAccountState {
  set(account: string, to: string, operation: Operation, state: TransactionState): void;
  hasPending(account: string): boolean;
  isPending(to: string, operation: Operation): boolean;
  isSent(to: string, operation: Operation): boolean;
}

export class AccountState implements IAccountState {
  private states: Map<string, Map<string, TransactionState>> = new Map<
    string,
    Map<string, TransactionState>
  >();

  public set(account: string, to: string, operation: Operation, state: TransactionState) {
    const hasAccount = this.states.has(account);
    if (!hasAccount) {
      this.states.set(account, new Map<string, TransactionState>());
    }

    const key = this.createKey(to, operation);
    this.states.get(account).set(key, state);
  }

  public hasPending(account: string): boolean {
    const accountStates = this.states.get(account);
    if (!accountStates) {
      return false;
    }

    return Array.from(accountStates.values()).some(s => s === TransactionState.PENDING);
  }

  public isSent(to: string, operation: Operation): boolean {
    return this.hasState(to, operation, TransactionState.SENT);
  }

  public isPending(to: string, operation: Operation): boolean {
    return this.hasState(to, operation, TransactionState.PENDING);
  }

  private hasState(to: string, operation: Operation, state: TransactionState): boolean {
    const transactions = Array.from(this.states.values());
    const key = this.createKey(to, operation);

    return transactions.some(tx => tx.get(key) === state);
  }

  private createKey(to: string, operation: Operation): string {
    return to.concat('-', operation.toString());
  }
}
