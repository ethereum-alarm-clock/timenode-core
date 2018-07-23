export default class MockLogger {
  public debug(msg: string) {
    console.log(`[debug] ${msg}`);
  }

  public cache(msg: string) {
    console.log(`[cache] ${msg}`);
  }

  public info(msg: string) {
    console.log(`[info] ${msg}`);
  }

  public error(msg: string) {
    console.log(`[error] ${msg}`);
  }
}
