import { ILogger } from './ILogger';

declare const console: any;

export class DefaultLogger implements ILogger {
  public debug(msg: string, address: string = ''): void {
    this.formatPrint('DEBUG', msg, address);
  }

  public error(msg: string, address: string = ''): void {
    this.formatPrint('ERROR', msg, address);
  }

  public info(msg: string, address: string = ''): void {
    this.formatPrint('INFO', msg, address);
  }

  private formatPrint(kind: string, msg: string, address: string = ''): void {
    const txRequest = address ? ` [${address}]` : '';
    console.log(`${this.now()} [${kind}]${txRequest} ${msg}`);
  }

  private now(): string {
    return new Date().toISOString();
  }
}
