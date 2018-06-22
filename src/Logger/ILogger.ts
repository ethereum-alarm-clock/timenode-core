export interface ILogger {
  cache(message: string): void;
  debug(message: string): void;
  error(message: string): void;
  info(message: string): void;
}
