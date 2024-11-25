"use strict";

const fs = require("fs/promises");
const path = require("path");
const md5File = require('md5-file');
const naturalCompare = require('./natural-compare');

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
    const next = async () => {
        if (files.length) {
            const id = files.shift();
            const hash = await md5File(id);
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
    saveHash,
    loadHash,
    getHash
};
