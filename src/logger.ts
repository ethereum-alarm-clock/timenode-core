declare const console;

interface ILogger {
    cache: Function,
    debug: Function,
    error: Function,
    info: Function,
}

class DefaultLogger implements ILogger {
    cache(msg: String): void {
        this.formatPrint(msg, 'CACHE');
    }

    debug(msg: String): void {
        this.formatPrint(msg, 'DEBUG');
    }

    error(msg: String): void {
        this.formatPrint(msg, 'ERROR');
    }

    info(msg: String): void {
        this.formatPrint(msg, 'INFO');
    }

    formatPrint(msg: String, kind: String): void {
        console.log(kind, this.timestamp(), msg);
    }

    timestamp(): number {
        return Math.floor(Date.now()/1000)
    }
}

export {
    ILogger,
    DefaultLogger,
}
