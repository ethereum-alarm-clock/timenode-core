export default class MockLogger {
  debug(msg: string) {
    console.log(`[debug] ${msg}`);
  }

  cache(msg: string) {
    console.log(`[cache] ${msg}`);
  }

  info(msg: string) {
    console.log(`[info] ${msg}`);
  }

  error(msg: string) {
    console.log(`[error] ${msg}`);
  }
}
