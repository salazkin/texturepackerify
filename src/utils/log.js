const colors = {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
};

const color = (str, color) => {
    const colorCode = colors[color?.toLowerCase()] || colors.reset;
    return `${colorCode}${str}${colors.reset}`;
};

const bold = (str) => {
    return `\x1b[1m${str}\x1b[22m`;
};

const trace = (...args) => {
    console.log(...args);
};

const clearLastLine = () => {
    process.stdout.write('\x1b[1A');
    process.stdout.write('\x1b[2K');
};

module.exports = {
    color,
    bold,
    trace,
    clearLastLine
};