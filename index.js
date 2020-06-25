"use strict";

const fs = require("fs");
const pack = require('./src/pack');
const extract = require('./src/extract');
const hashUtils = require('./src/hash-utils');

let oldHash = {};
let newHash = null;

let force = false;
let hashUrl = "";
let assetsUrl = "";
let scales = null;

function extractAtlases(config = {}, cb) {
    assetsUrl = config.url || "./";
    hashUrl = config.hashUrl || assetsUrl;
    if (!fs.existsSync(assetsUrl)) {
        trace("", `No dir ${assetsUrl}`, "\x1b[31m");
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
}

function packAtlases(config = {}, cb) {
    assetsUrl = config.url || "./";
    hashUrl = config.hashUrl || assetsUrl;
    force = config.force || false;
    scales = config.scales || [1];
    if (!fs.existsSync(assetsUrl)) {
        trace("", `No dir ${assetsUrl}`, "\x1b[31m");
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
            hashUtils.saveHash(hashUrl, oldHash, () => {
                if (cb) {
                    cb();
                }
            });
        }
    };
    next();
};

function getHash(next) {
    hashUtils.getHash(getFiles(), (hash) => {
        newHash = hash;
        hashUtils.loadHash(hashUrl, (hash) => {
            oldHash = hash;
            next();
        });
    });
}

function buildAtlas(dir, next) {
    const files = fs.readdirSync(dir).filter((value) => value.indexOf(".png") > -1 || value.indexOf(".json") > -1);
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
        trace("Pack", dir + ".json", "\x1b[32m");
        pack({ src: dir, hash: newHash, scales: scales }, () => {
            hashUtils.saveHash(hashUrl, oldHash, next);
        });
    } else {
        next();
    }
}

function isAtlasExists(path) {
    if (scales.length === 1) {
        return fs.existsSync(path + ".json");
    } else {
        return fs.existsSync(path + "@1x.json");
    }
}

function getFiles() {
    const files = fs.readdirSync(assetsUrl);
    let list = [];

    files.forEach(file => {
        if (fs.lstatSync(assetsUrl + file).isDirectory()) {
            list = list.concat(fs.readdirSync(assetsUrl + file).map((id) => assetsUrl + file + "/" + id));
            list = list.filter((id) => id.indexOf(".png") !== -1 || id.indexOf(".json") !== -1);
        }
    });

    return list;
}

function trace(prefix, str, color) {
    console.log(`${prefix ? prefix + " " : ""}${color || ""}${str}\x1b[0m`);
}

module.exports = {
    pack: packAtlases,
    extract: extractAtlases
};
