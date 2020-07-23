"use strict";

const COLOR = {
    BLACK: "\x1b[30m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    BLUE: "\x1b[34m",
    MAGENTA: "\x1b[35m",
    CYAN: "\x1b[36m",
    WHITE: "\x1b[37m"
};

const trace = (prefix, str, color) => {
    console.log(`${prefix ? prefix + " " : ""}${color || ""}${str}\x1b[0m`);
};

module.exports = {
    trace,
    COLOR
};
