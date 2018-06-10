class MockLogger {
  debug(msg) {
    console.log(`[debug] ${msg}`);
  }

  cache(msg) {
    console.log(`[cache] ${msg}`);
  }

  info(msg) {
    console.log(`[info] ${msg}`);
  }

  error(msg) {
    console.log(`[error] ${msg}`);
  }
}

module.exports = MockLogger;