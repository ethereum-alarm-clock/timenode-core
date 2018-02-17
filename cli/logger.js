const fs = require("fs")

class Logger {
  // 1 - debug / cache
  // 2 - info
  // 3 - error

  constructor(logfile, logLevel) {
    if (logfile === "console") {
      this.logToFile = false
    } else {
      this.logToFile = true
      this.logfile = logfile
      fs.writeFileSync(this.logfile, "\n")
    }
    this.logLevel = logLevel
  }

  debug(msg) {
    if (this.logLevel > 1) {
      return
    }
    if (this.logToFile) {
      fs.appendFileSync(this.logfile, `[debug] ${msg}\n`)
    } else {
      console.log(`[debug] ${msg}`)
    }
  }

  cache(msg) {
    if (this.logLevel > 1) {
      return
    }
    if (this.logToFile) {
      fs.appendFileSync(this.logfile, `[cache] ${msg}\n`)
    } else {
      console.log(`[cache] ${msg}`)
    }
  }

  info(msg) {
    if (this.logLevel > 2) {
      return
    }
    if (this.logToFile) {
      fs.appendFileSync(this.logfile, `[info] ${msg}\n`)
    } else {
      console.log(`[info] ${msg}`)
    }
  }

  error(msg) {
    if (this.logToFile) {
      fs.appendFileSync(this.logfile, `[error] ${msg}\n`)
    } else {
      console.log(`[error] ${msg}`)
    }
  }
}

module.exports = Logger
