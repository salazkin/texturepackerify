"use strict";

const fs = require("fs");
const pack = require('./src/pack');
const extract = require('./src/extract');
const filesHelper = require('./src/utils/files-helper');
const log = require('./src/utils/log');

let oldHash = {};
let newHash = null;

let force = false;
let hashUrl = "";
let assetsUrl = "";
let scales = null;
let defaultAtlasConfig = {
    extraSpace: 2,
    jpg: false,
    extrude: false,
    pot: true,
    square: false,
    colorDepth: 8,
    spriteExtensions: true,
    animations: false
};

const extractAtlases = (config = {}, cb) => {
    assetsUrl = config.url || "./";
    hashUrl = config.hashUrl || assetsUrl;

    if (!fs.existsSync(assetsUrl)) {
        log.trace("", `No dir ${assetsUrl}`, log.COLOR.RED);
        return;
    }

    let extractList = [];
    const files = fs.readdirSync(assetsUrl);
    let skipList = [];
    files.forEach((file) => {
        if (fs.lstatSync(assetsUrl + file).isDirectory()) {
            skipList.push(file);
        } else {
            let match = file.indexOf(".json");
            if (match > -1) {
                extractList.push(file.substring(0, match));
            }
        }
    });

    extractList = extractList.filter((id) => skipList.indexOf(id) == -1);

    const next = () => {
        if (extractList.length) {
            extract(assetsUrl + extractList.shift(), next);
        } else {
            if (cb) {
                cb();
            }
        }
    };
    next();
};

const packAtlases = (config = {}, cb) => {
    assetsUrl = config.url || "./";
    hashUrl = config.hashUrl || assetsUrl;
    force = config.force || false;
    scales = config.scales || [1];
    defaultAtlasConfig = Object.assign({}, defaultAtlasConfig, config.defaultAtlasConfig);

    if (!fs.existsSync(assetsUrl)) {
        log.trace("", `No dir ${assetsUrl}`, log.COLOR.RED);
        return;
    }

    let packList = [];
    const files = fs.readdirSync(assetsUrl);
    files.forEach((file) => {
        if (fs.lstatSync(assetsUrl + file).isDirectory()) {
            packList.push(file);
        }
    });

    const next = () => {
        if (!newHash) {
            getHash(next);
        } else if (packList.length) {
            buildAtlas(assetsUrl + packList.shift(), next);
        } else {
            filesHelper.saveHash(hashUrl, oldHash, () => {
                if (cb) {
                    cb();
                }
            });
        }
    };
    next();
};

const getHash = (next) => {
    filesHelper.getHash(getFiles(), hash => {
        newHash = hash;
        filesHelper.loadHash(hashUrl, hash => {
            oldHash = hash;
            next();
        });
    });
};

const buildAtlas = (dir, next) => {
    const files = filesHelper.getFilesRecursive(dir + "/", false).filter(value => value.indexOf(".png") > -1 || value.indexOf(".json") > -1);

    let skip = true;

    if (files.length > 0) {
        files.forEach(file => {
            let fileId = dir + "/" + file;
            if (oldHash[fileId] === undefined || oldHash[fileId] !== newHash[fileId]) {
                skip = false;
                oldHash[fileId] = newHash[fileId];
            }
        });

        if (force) {
            skip = false;
        }

        if (!isAtlasExists(dir)) {
            skip = false;
        }
    }

    for (let hashId in oldHash) {
        if (hashId.indexOf(dir) > -1 && newHash[hashId] === undefined) {
            oldHash[hashId] = undefined;
            skip = false;
        }
    }
    if (!skip) {
        log.trace("Pack", dir + ".json", log.COLOR.GREEN);
        pack({ src: dir, hash: newHash, scales, defaultAtlasConfig }, () => {
            filesHelper.saveHash(hashUrl, oldHash, next);
        });
    } else {
        next();
    }
};

const isAtlasExists = (path) => {
    if (scales.length === 1) {
        return fs.existsSync(path + ".json");
    } else {
        return fs.existsSync(path + "@1x.json");
    }
};

const getFiles = () => {
    const files = fs.readdirSync(assetsUrl);
    let list = [];

    files.forEach(file => {
        if (fs.lstatSync(assetsUrl + file).isDirectory()) {
            list = list.concat(filesHelper.getFilesRecursive(assetsUrl + file + "/").filter(id => id.indexOf(".png") !== -1 || id.indexOf(".json") !== -1));
        }
    });
    return list;
};


module.exports = {
    pack: packAtlases,
    extract: extractAtlases
};
