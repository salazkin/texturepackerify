"use strict";

const fs = require("fs/promises");
const path = require("path");
const naturalCompare = require('./natural-compare');
const crypto = require('crypto');

const getFilesRecursive = async (dir, prependPath = true) => {
    const allFiles = [];
    const parseDir = async (dirPath) => {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.lstat(filePath);
            if (stats.isDirectory()) {
                await parseDir(filePath);
            } else {
                allFiles.push(filePath);
            }
        }
    };
    const normalizedPath = path.normalize(dir);
    await parseDir(normalizedPath);

    const prependNormalizedPath = normalizedPath.endsWith(path.sep) ? normalizedPath : normalizedPath + path.sep;
    return prependPath ? allFiles : allFiles.map(file => file.substring(prependNormalizedPath.length, file.length));
};

const isFileExists = async (filePath) => {
    return fs.access(filePath).then(() => true).catch(() => false);
};

const createDirectoryRecursive = async (dir) => {
    try {
        await fs.access(dir);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.mkdir(dir, { recursive: true });
        } else {
            throw err;
        }
    }
};

const loadHash = async (hashPath) => {
    let hashData = {};
    try {
        const data = await fs.readFile(hashPath, "utf-8");
        hashData = JSON.parse(data);
    } catch (err) {
        //returning empty hash;
    }
    return hashData;
};

const getHash = async (list) => {
    const hashData = {};
    const files = [...list];

    const calculateHash = async (filePath) => {
        const hash = crypto.createHash('md5');
        const data = await fs.readFile(filePath);
        hash.update(data);
        return hash.digest('hex');
    };

    const next = async () => {
        if (files.length) {
            const id = files.shift();
            const hash = await calculateHash(id);
            hashData[id] = hash;
            await next();
        }
        return hashData;
    };
    await next();
    return hashData;
};

const saveHash = async (hashPath, hash) => {
    await fs.writeFile(hashPath, JSON.stringify(hash, Object.keys(hash).sort(naturalCompare)));
};

module.exports = {
    getFilesRecursive,
    createDirectoryRecursive,
    isFileExists,
    saveHash,
    loadHash,
    getHash
};
