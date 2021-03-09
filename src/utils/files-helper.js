"use strict";

const fs = require("fs");
const md5File = require('md5-file');
const naturalCompare = require('./natural-compare');
const tmpdir = require('os').tmpdir();

const getTempFolderPath = () => {
    return tmpdir + "/texturepackerify";
};

const clearTempFolderIfOversized = () => {
    const path = getTempFolderPath();
    if (fs.existsSync(path)) {
        let size = 0;
        fs.readdirSync(path).forEach((file) => {
            size += fs.statSync(path + "/" + file).size;
        });
        if (size > 100 * 1024 * 1024) {
            clearTempFolder();
        }
    }
};

const clearTempFolder = () => {
    const path = getTempFolderPath();
    deleteFolderRecursive(path);
};

const deleteFolderRecursive = (path) => {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach((file) => {
            const currentPath = path + "/" + file;
            if (fs.lstatSync(currentPath).isDirectory()) {
                deleteFolderRecursive(currentPath);
            } else {
                fs.unlinkSync(currentPath);
            }
        });
        fs.rmdirSync(path);
    }
};

const getFilesRecursive = (src, prependPath = true) => {
    const allFiles = [];
    const parseDir = (path) => {
        const files = fs.readdirSync(path);
        files.forEach(file => {
            const filePath = path + file;
            if (fs.lstatSync(filePath).isDirectory()) {
                parseDir(filePath + "/");
            } else {
                allFiles.push(filePath);
            }
        });
    };
    parseDir(src);
    return prependPath ? allFiles : allFiles.map(file => file.substring(src.length, file.length));
};


const loadHash = (assetsUrl, cb) => {
    let hashData = {};
    if (fs.existsSync(assetsUrl + "hash.json")) {
        fs.readFile(assetsUrl + "hash.json", "utf-8", function (err, data) {
            hashData = JSON.parse(data);
            cb(hashData);
        });
    } else {
        cb(hashData);
    }
};

const getHash = (list, cb) => {
    const files = JSON.parse(JSON.stringify(list));
    const hashData = {};
    const next = function () {
        if (files.length) {
            const id = files.shift();
            md5File(id, (err, hash) => {
                hashData[id] = hash;
                next();
            });
        } else {
            cb(hashData);
        }
    };
    next();
};

const saveHash = (assetsUrl, hash, cb) => {
    fs.writeFile(assetsUrl + "hash.json", JSON.stringify(hash, Object.keys(hash).sort(naturalCompare)), () => {
        md5File(assetsUrl + "hash.json", () => {
            cb();
        });
    });
};

module.exports = {
    clearTempFolderIfOversized,
    clearTempFolder,
    deleteFolderRecursive,
    getTempFolderPath,
    getFilesRecursive,
    saveHash,
    loadHash,
    getHash
};
