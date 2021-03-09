const naturalCompare = require('./natural-compare');

const removeExtension = (str) => {
    const split = str.split(".");
    split.length = Math.min(1, split.length - 1);
    return split.join(".");
};

const orderedStringify = (obj) => {
    const allKeys = [];
    JSON.stringify(obj, (k, v) => {
        allKeys.push(k);
        return v;
    });
    return JSON.stringify(obj, allKeys.sort(naturalCompare));
};

const parseSequenceString = (str) => {
    const numArr = [];
    let name = str;
    const out = { prefix: name, suffix: null, suffixIncremented: null, extension: "" };

    if (str.indexOf(".png") !== -1) {
        name = str.substring(0, str.indexOf(".png"));
        out.prefix = name;
        out.extension = ".png";
    }

    for (let i = name.length - 1; i >= 0; i--) {
        const char = name[i];
        if (!isNaN(char)) {
            numArr.unshift(char);
        } else {
            break;
        }
    }
    if (numArr.length > 0) {
        out.suffix = numArr.join("");
        out.prefix = name.substring(0, name.length - out.suffix.length);
        out.suffixIncremented = (Number(out.suffix) + 1).toLocaleString('en-US', { minimumIntegerDigits: numArr.length, useGrouping: false });
    }

    return out;
};

module.exports = {
    removeExtension,
    orderedStringify,
    parseSequenceString
};
