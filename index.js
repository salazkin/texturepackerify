"use strict";

const fs = require("fs/promises");
const path = require("path");
const pack = require('./src/pack');
const filesHelper = require('./src/utils/files-helper');
const promiseUtils = require('./src/utils/promise-utils');
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
 * @param {string} [config.inputDir="."] - Directory containing input atlas folders.
 * @param {string} [config.outputDir] - Directory for the generated output. Default: Same as `inputDir`.
 * @param {string} [config.hashPath=".texturepackerify/hash.json"] - Path to the hash file for caching.
 * @param {boolean} [config.force=false] - Specifies whether to force a rebuild of the atlases.
 * @param {number[]} [config.scales=[1]] - An array of scale factors for generating mipmaps.
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
    inputDir = path.normalize(config.inputDir ?? ".");
    outputDir = path.normalize(config.outputDir ?? inputDir);
    hashPath = path.normalize(config.hashPath ?? path.join(tempDir, "hash.json"));
    force = config.force ?? false;
    scales = config.scales ?? [1];
    enableLogs = config.enableLogs ?? true;
    onProgressCallback = config.onProgress;
    defaultAtlasConfig = Object.assign({}, defaultAtlasConfig, config.defaultAtlasConfig);
    startTime = performance.now();

    await filesHelper.createDirectoryRecursive(tempDir);
    await filesHelper.createDirectoryRecursive(outputDir);
    await filesHelper.createDirectoryRecursive(path.dirname(hashPath));

    const assetsExist = await filesHelper.isFileExists(inputDir);
    if (!assetsExist) {
        throw new Error(`No folder ${inputDir}`);
    }
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

                    const atlasExists = await isAtlasExists(atlasDir);
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
                    await pack({ atlasDir, hash: newHash, scales, defaultAtlasConfig, tempDir, outputDir });
                    await filesHelper.saveHash(hashPath, oldHash);
                }

                onProgress(i + 1, packList.length);
            };
        }));
    } catch (error) {
        console.error(error.message);
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

const isAtlasExists = async (atlasPath) => {
    if (scales.length === 1 && scales[0] === 1) {
        return filesHelper.isFileExists(`${atlasPath}.json`);
    } else {
        const filesExistArr = await Promise.all(scales.map(scale => filesHelper.isFileExists(`${atlasPath}@${scale}x.json`)));
        return filesExistArr.every(value => value === true);
    }
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
