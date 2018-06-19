export default class MockLogger {
  debug(msg: String) {
    console.log(`[debug] ${msg}`);
  }

  cache(msg: String) {
    console.log(`[cache] ${msg}`);
  }

  info(msg: String) {
    console.log(`[info] ${msg}`);
  }

  error(msg: String) {
    console.log(`[error] ${msg}`);
  }
}
