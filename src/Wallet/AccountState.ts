export enum TransactionState {
  ERROR,
  PENDING,
  SENT,
  CONFIRMED
}

export interface IAccountState {
  set(account: string, to: string, state: TransactionState): void;
  hasPending(account: string): boolean;
  isConfirmed(to: string): boolean;
  isPending(to: string): boolean;
}

export class AccountState implements IAccountState {
  private states: Map<string, Map<string, TransactionState>> = new Map<
    string,
    Map<string, TransactionState>
  >();

  public set(account: string, to: string, state: TransactionState) {
    const hasAccount = this.states.has(account);
    if (!hasAccount) {
      this.states.set(account, new Map<string, TransactionState>());
    }

    this.states.get(account).set(to, state);
  }

  public hasPending(account: string): boolean {
    const accountStates = this.states.get(account);
    if (!accountStates) {
      return false;
    }

    return Array.from(accountStates.values()).some(s => s === TransactionState.PENDING);
  }

  public isConfirmed(to: string): boolean {
    return this.hasState(to, TransactionState.CONFIRMED);
  }

  public isPending(to: string): boolean {
    return this.hasState(to, TransactionState.PENDING);
  }

  public isError(to: string): boolean {
    return this.hasState(to, TransactionState.ERROR);
  }

  private hasState(to: string, state: TransactionState): boolean {
    const transactions = Array.from(this.states.values());

    return transactions.some(tx => tx.get(to) === state);
  }
}
