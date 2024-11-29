"use strict";

const fs = require("fs/promises");
const path = require("path");
const pack = require('./src/pack');
const filesHelper = require('./src/utils/files-helper');
const promiseUtils = require('./src/utils/promise-utils');
const stringUtils = require('./src/utils/string-utils');
const log = require('./src/utils/log');

const tempDir = ".texturepackerify";
let oldHash = null;
let newHash = null;

let force = false;
let inputDir = "";
let outputDir = "";
let hashPath = "";
let scales = null;
let enableLogs = true;
let onProgressCallback = null;
let atlasNameTemplate = "";
let startTime;
let defaultAtlasConfig = {
    extraSpace: 2,
    border: 0,
    alphaThreshold: 1,
    jpg: false,
    extrude: false,
    pot: true,
    square: false,
    spriteExtensions: true,
    animations: false,
    allowTrim: true,
    allowRotation: true,
    maxWidth: 4096,
    maxHeight: 4096
};

/**
 * Packs textures into atlases using the TexturePackerify tool.
 *
 * @async
 * @function
 * @param {Object} config - Pack config.
 * @param {string} [config.inputDir="./"] - The directory containing input atlas folders.
 * @param {string} [config.outputDir] - The directory for the generated output. Default: Same as `inputDir`.
 * @param {string} [config.hashPath="./.texturepackerify/hash.json"] - The path to the hash file for caching.
 * @param {boolean} [config.force=false] - Specifies whether to force a rebuild of the atlases.
 * @param {number[]} [config.scales=[1]] - An array of scale factors for generating mipmaps.
 * @param {string} [config.atlasNameTemplate="{n}@{s}x"] - A template for the output atlas name, where `{n}` is the folder name and `{s}` is the scale factor.
 * @param {boolean} [config.enableLogs=true] - Enables or disables console logs.
 * @param {Function} [config.onProgress] - Callback for progress updates.
 * @param {Object} [config.defaultAtlasConfig] - Overrides for the default configuration of atlas settings.
 * @param {number} [config.defaultAtlasConfig.extraSpace=2] - Space (in pixels) between texture frames.
 * @param {number} [config.defaultAtlasConfig.border=0] - Border (in pixels) around the atlas texture.
 * @param {boolean} [config.defaultAtlasConfig.jpg=false] - Set to `true` to output the atlas as a JPEG file.
 * @param {boolean|Array} [config.defaultAtlasConfig.extrude=false] - Expand image borders by one pixel in all directions. Accepts `true`, `false`, or an array of IDs.
 * @param {boolean} [config.defaultAtlasConfig.pot=true] - Force the atlas size to be a power of two (e.g., 256x256, 512x512).
 * @param {boolean} [config.defaultAtlasConfig.square=false] - Force the atlas size to be square.
 * @param {boolean} [config.defaultAtlasConfig.animations=false] - Enable animation parsing.
 * @param {number} [config.defaultAtlasConfig.alphaThreshold=1] - Alpha threshold value for trimming transparent areas.
 * @param {boolean} [config.defaultAtlasConfig.spriteExtensions=true] - Append extensions (e.g., `.png`) to sprite frame names.
 * @param {boolean} [config.defaultAtlasConfig.allowRotation=true] - Allows sprite frame rotation.
 * @param {boolean} [config.defaultAtlasConfig.allowTrim=true] - Enables the trimming of transparent pixels.
 * @param {number} [config.defaultAtlasConfig.maxWidth=4096] - Maximum texture width (in pixels).
 * @param {number} [config.defaultAtlasConfig.maxHeight=4096] - Maximum texture height (in pixels).
 * @returns {Promise<void>}
 *
 * @example
 * await texturepackerify.pack({
 *   inputDir: "atlases",
 *   scales: [1, 0.5],
 *   defaultAtlasConfig: {
 *     pot: false
 *   }
 * });
 */

const packAtlases = async (config = {}) => {
    oldHash = {};
    newHash = null;

    if (!config.inputDir) {
        console.error("Pack config error: No 'config.inputDir'");
        return;
    }

    if (typeof config.inputDir !== 'string') {
        console.error("Pack config error: 'config.inputDir' must be a string");
        return;
    }

    inputDir = path.normalize(config.inputDir);

    const assetsExist = await filesHelper.isFileExists(inputDir);
    if (!assetsExist) {
        console.error(`No input folder: ${inputDir}`);
        return;
    }

    if (config.outputDir !== undefined && typeof config.outputDir !== 'string') {
        console.error("Pack config error: 'config.outputDir' must be a string");
        return;
    }

    outputDir = path.normalize(config.outputDir ?? inputDir);

    if (config.hashPath !== undefined && typeof config.hashPath !== 'string') {
        console.error("Pack config error: 'config.hashPath' must be a string");
        return;
    }

    hashPath = tempDir;

    if (config.hashPath) {
        hashPath = path.normalize(config.hashPath);
    }

    if (!hashPath.endsWith(".json")) {
        hashPath = path.join(hashPath, "hash.json");
    }

    if (config.force !== undefined && typeof config.force !== 'boolean') {
        console.error("Pack config error: 'config.force' must be a boolean");
        return;
    }

    force = config.force ?? false;

    scales = config.scales ?? [1];

    if (scales) {
        if (!Array.isArray(scales)) {
            console.error("Pack config error: 'config.scales' must be an array");
            return;
        }
        if (scales.length === 0) {
            console.error("Pack config error: 'config.scales' cannot be empty");
            return;
        }

        for (const scale of scales) {
            if (typeof scale !== 'number') {
                console.error("Pack config error: All elements in 'config.scales' array must be a numbers");
                return;
            }
        }

        scales = [...new Set(scales)];
    }

    if (config.enableLogs !== undefined && typeof config.enableLogs !== 'boolean') {
        console.error("Pack config error: 'config.enableLogs' must be a boolean");
        return;
    }

    enableLogs = config.enableLogs ?? true;

    if (config.atlasNameTemplate !== undefined && typeof config.atlasNameTemplate !== 'string') {
        console.error("Pack config error: 'config.atlasNameTemplate' must be a string");
        return;
    }

    atlasNameTemplate = config.atlasNameTemplate ?? "{n}@{s}x";

    if (!atlasNameTemplate.includes("{n}")) {
        console.error("Pack config error: No '{n}' placeholder in 'config.atlasNameTemplate'");
        return;
    }

    if (scales.length > 1 && !atlasNameTemplate.includes("{s}")) {
        console.error("Pack config error: 'config.atlasNameTemplate' should have placeholder '{s}' if more then one scale factor in 'config.scales' array");
        return;
    }

    if (config.onProgress !== undefined && !(config.onProgress instanceof Function)) {
        console.error("Pack config error: 'config.onProgress' must be a Function");
        return;
    }

    onProgressCallback = config.onProgress;

    defaultAtlasConfig = Object.assign({}, defaultAtlasConfig, config.defaultAtlasConfig);
    startTime = performance.now();

    await filesHelper.createDirectoryRecursive(outputDir);
    await filesHelper.createDirectoryRecursive(path.dirname(hashPath));

    let packList = [];
    const files = await fs.readdir(inputDir);
    for (const file of files) {
        const currentPath = path.join(inputDir, file);
        const stats = await fs.lstat(currentPath);
        if (stats.isDirectory()) {
            packList.push(file);
        }
    }

    onProgress(0, packList.length);
    await getHash();
    try {
        await promiseUtils.sequence(packList.map((folderName, i) => {
            return async () => {
                const atlasDir = path.join(inputDir, folderName);
                const files = await filesHelper.getFilesRecursive(atlasDir, false);
                const pngAndJsonFiles = files.filter(value => value.endsWith(".png") || value.endsWith(".json"));
                let skip = true;

                if (pngAndJsonFiles.length > 0) {
                    pngAndJsonFiles.forEach(file => {
                        let fileId = path.join(atlasDir, file);
                        if (oldHash[fileId] === undefined || oldHash[fileId] !== newHash[fileId]) {
                            skip = false;
                            oldHash[fileId] = newHash[fileId];
                        }
                    });

                    if (force) {
                        skip = false;
                    }

                    const atlasExists = await isAtlasExists(folderName);
                    if (!atlasExists) {
                        skip = false;
                    }
                }
                for (let hashId in oldHash) {
                    if (hashId.indexOf(atlasDir) > -1 && newHash[hashId] === undefined) {
                        oldHash[hashId] = undefined;
                        skip = false;
                    }
                }

                if (!skip) {
                    await pack({ atlasDir, hash: newHash, scales, defaultAtlasConfig, outputDir, atlasNameTemplate });
                    await filesHelper.saveHash(hashPath, oldHash);
                }

                onProgress(i + 1, packList.length);
            };
        }));
    } catch (error) {
        console.error(error.message);
        //console.error(error.stack);
        return;
    }
};

const onProgress = (finished, total) => {
    if (onProgressCallback) {
        onProgressCallback({ finished, total });
    }
    if (enableLogs) {
        if (finished > 0) {
            log.clearLastLine();
        }
        const isFinished = finished === total;
        const time = isFinished ? `in ${Math.round(performance.now() - startTime)} ms` : "";
        const progress = isFinished ? log.color("[complete]", "green") : `[${Math.floor(finished / total * 100)}%]`;
        log.trace("packing", log.bold(`${inputDir}`), log.bold(progress), time);
    }
};

const getHash = async () => {
    const list = await getFiles();
    newHash = await filesHelper.getHash(list);
    oldHash = await filesHelper.loadHash(hashPath);
};

const isAtlasExists = async (atlasName) => {
    const filesExistArr = await Promise.all(scales.map(scale => {
        const hashPath = path.join(outputDir, `${atlasNameTemplate.replace(/{n}/g, atlasName).replace(/{s}/g, scale)}.json`);
        console.log(hashPath);
        return filesHelper.isFileExists(hashPath);
    }));
    return filesExistArr.every(value => value === true);
};

const getFiles = async () => {
    const files = await fs.readdir(inputDir);
    let list = [];

    for (const file of files) {
        const filePath = path.join(inputDir, file);
        const stats = await fs.lstat(filePath);
        if (stats.isDirectory()) {
            const subFiles = await filesHelper.getFilesRecursive(path.join(inputDir, file));
            list = list.concat(subFiles.filter(id => id.endsWith(".png") || id.endsWith(".json")));
        }
    }
    return list;
};

module.exports = {
    pack: packAtlases
};
