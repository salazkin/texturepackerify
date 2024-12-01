"use strict";

const fs = require("fs/promises");
const path = require("path");
const pack = require('./src/pack');
const filesHelper = require('./src/utils/files-helper');
const promiseUtils = require('./src/utils/promise-utils');
const log = require('./src/utils/log');

const tempDir = ".texturepackerify";
const availableFormats = ["png", "jpeg", "webp", "avif"];

let oldHash = null;
let newHash = null;

let force = false;
let inputDir = "";
let outputDir = "";
let hashPath = "";
let scales = null;
let enableLogs = true;
let onProgressCallback = null;
let appendFileHash = false;
let appendTextureFormat = false;
let textureFormat = "";
let startTime;

const atlasNameMaxHashLength = 20;

let defaultAtlasConfig = {
    extraSpace: 2,
    border: 0,
    alphaThreshold: 1,
    removeAlpha: false,
    jpeg: false,
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

let formatConfig = null;

/**
* Parameters texture formats.
* @typedef {Object} FormatConfig
* @property {Object} [jpeg] - Configuration options for `jpeg` texture format.
* @property {number} [jpeg.quality=80] - Specifies compression quality (1-100).
* @property {Object} [webp] - Configuration options for `webp` texture format.
* @property {number} [webp.quality=80] - Specifies compression quality (1-100).
* @property {number} [webp.alphaQuality=80] - Specifies compression quality for alpha channel (0-100).
* @property {Object} [avif] - Configuration options for `avif` texture format.
* @property {number} [avif.quality=80] - Specifies compression quality (1-100).
*/

/**
 * Parameters for the default atlas configuration.
 * @typedef {Object} AtlasConfig
 * @property {number} [extraSpace=2] - Space (in pixels) between texture frames.
 * @property {number} [border=0] - Border (in pixels) around the atlas texture.
 * @property {boolean} [jpeg=false] - Force to use `jpeg` instead of `png` for texture format.
 * @property {boolean} [removeAlpha=false] - Remove alpha channel.
 * @property {boolean|Array} [extrude=false] - Expand image borders by one pixel in all directions. Accepts `true`, `false`, or an array of IDs.
 * @property {boolean} [pot=true] - Force the atlas size to be a power of two (e.g., 256x256, 512x512).
 * @property {boolean} [square=false] - Force the atlas size to be square.
 * @property {boolean} [animations=false] - Enable animation parsing.
 * @property {number} [alphaThreshold=1] - Alpha threshold value for trimming transparent areas.
 * @property {boolean} [spriteExtensions=true] - Append extensions (e.g., `.png`) to sprite frame names.
 * @property {boolean} [allowRotation=true] - Allows sprite frame rotation.
 * @property {boolean} [allowTrim=true] - Enables the trimming of transparent pixels.
 * @property {number} [maxWidth=4096] - Maximum texture width (in pixels).
 * @property {number} [maxHeight=4096] - Maximum texture height (in pixels).
 */

/**
 * Packs textures into atlases using the TexturePackerify tool.
 * @async
 * @function
 * @param {Object} config - Pack config.
 * @param {string} [config.inputDir="./"] - The directory containing input atlas folders.
 * @param {string} [config.outputDir=inputDir] - The directory for the generated output. Default: Same as `inputDir`.
 * @param {string} [config.hashPath="./.texturepackerify/hash.json"] - The path to the hash file for caching.
 * @param {boolean} [config.force=false] - Specifies whether to force a rebuild of the atlases.
 * @param {number[]} [config.scales=[1]] - An array of scale factors for generating mipmaps.
 * @param {boolean} [config.appendFileHash=false] - Specifies whether to add file hash to output file names.
 * @param {boolean} [config.appendTextureFormat=false] - Specifies whether to add texture format to output atlas names.
 * @param {"png"|"jpeg"|"webp"|"avif"} [config.textureFormat="png"] - Specifies the texture output format.
 * @param {boolean} [config.enableLogs=true] - Enables or disables console logs.
 * @param {Function} [config.onProgress] - Callback for progress updates.
 * @param {AtlasConfig} [config.defaultAtlasConfig] - Overrides for the default configuration of atlas settings.
 * @param {FormatConfig} [config.formatConfig] - Overrides for the default configuration of atlas settings.
 * @returns {Promise<void>}
 * @example
 * 
 * const texturepackerify = require("texturepackerify");
 * const packAtlases = async () => {
 *   await texturepackerify.pack({
 *     inputDir: "./atlases",
 *     outputDir: "./public/assets",
 *     textureFormat: "webp",
 *     scales: [1, 0.5],
 *     defaultAtlasConfig: {
 *       pot: false,
 *       animations: true,
 *       border: 2,
 *     },
 *     formatConfig: {
 *       webp: { quality: 80 },
 *     },
 *  });
 * };
 * packAtlases();
 */

const packAtlases = async (config = {}) => {
    oldHash = {};
    newHash = null;

    if (config.inputDir !== undefined && typeof config.inputDir !== 'string') {
        console.error("Pack config error: 'config.inputDir' must be a string");
        return;
    }

    inputDir = path.normalize(config.inputDir ?? ".");

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

    if (config.appendFileHash !== undefined && typeof config.appendFileHash !== 'boolean') {
        console.error("Pack config error: 'config.appendFileHash' must be a boolean");
        return;
    }

    appendFileHash = config.appendFileHash ?? false;

    if (config.appendTextureFormat !== undefined && typeof config.appendTextureFormat !== 'boolean') {
        console.error("Pack config error: 'config.appendTextureFormat' must be a boolean");
        return;
    }

    appendTextureFormat = config.appendTextureFormat ?? false;

    if (config.textureFormat !== undefined && !availableFormats.includes(config.textureFormat)) {
        console.error(`Pack config error: 'config.textureFormat' must one of the following string values: ${availableFormats.map(v => `'${v}'`).join(" | ")} `);
        return;
    }

    textureFormat = config.textureFormat ?? "png";

    if (config.onProgress !== undefined && !(config.onProgress instanceof Function)) {
        console.error("Pack config error: 'config.onProgress' must be a Function");
        return;
    }

    onProgressCallback = config.onProgress;

    defaultAtlasConfig = Object.assign({}, defaultAtlasConfig, config.defaultAtlasConfig);

    formatConfig = config.formatConfig;

    startTime = performance.now();

    await filesHelper.createDirectoryRecursive(outputDir);
    await filesHelper.createDirectoryRecursive(path.dirname(hashPath));

    let packList = await getPackList();

    const totalSteps = packList.length * scales.length;
    let finished = 0;

    onProgress(finished, totalSteps);

    await getHash();
    try {
        await promiseUtils.sequence(packList.map(folderName => {
            return async () => {

                const atlasDir = path.join(inputDir, folderName);
                const files = (await fs.readdir(atlasDir));
                const atlasResourceFiles = files.filter(value => value.endsWith(".png") || value.endsWith(".json"));
                let skip = true;

                if (force) {
                    skip = false;
                }

                if (atlasResourceFiles.length > 0) {
                    atlasResourceFiles.forEach(file => {
                        let fileId = path.join(atlasDir, file);
                        if (oldHash[fileId] === undefined || oldHash[fileId] !== newHash[fileId]) {
                            oldHash[fileId] = newHash[fileId];
                            skip = false;
                        }
                    });
                }

                for (let hashId in oldHash) {
                    if (hashId.indexOf(atlasDir) > -1 && newHash[hashId] === undefined) {
                        oldHash[hashId] = undefined;
                        skip = false;
                    }
                }

                await promiseUtils.sequence(scales.map(scale => {
                    return async () => {
                        const atlasConfig = await getAtlasConfig(atlasDir);
                        const outputTextureFormat = ((atlasConfig.jpeg || atlasConfig.jpg) && textureFormat === "png") ? "jpeg" : textureFormat;
                        const atlasName = getAtlasName(folderName, scale);

                        const atlasMatchFiles = await getAtlasMatchFiles(outputDir, atlasName, outputTextureFormat);
                        if (atlasMatchFiles.length < 2) {
                            skip = false;
                        }

                        if (!skip) {
                            if (atlasMatchFiles.length) {
                                await Promise.all(atlasMatchFiles.map(file => fs.unlink(path.join(outputDir, file))));
                            }
                            const packConfig = {
                                atlasDir,
                                hash: newHash,
                                scale,
                                atlasConfig,
                                outputDir,
                                atlasName,
                                appendFileHash,
                                appendTextureFormat,
                                atlasNameMaxHashLength,
                                textureFormat: outputTextureFormat,
                                formatConfig
                            };
                            await pack(packConfig);
                        }
                        await filesHelper.saveHash(hashPath, oldHash);
                        onProgress(++finished, totalSteps);
                    };
                }));
            };
        }));
    } catch (error) {
        console.error(error.message);
        //console.error(error.stack);
        return;
    }
};

const getPackList = async () => {
    let packList = [];
    const skipList = ["node_modules",];

    const files = await fs.readdir(inputDir);
    const resolvedOutputPath = path.resolve(outputDir);
    const resolvedTempPath = path.resolve(tempDir);

    for (const file of files) {
        const currentPath = path.join(inputDir, file);
        const stats = await fs.lstat(currentPath);
        if (stats.isDirectory() && !skipList.includes(file)) {
            const resolvedCurrentPath = path.resolve(file);
            if (resolvedCurrentPath !== resolvedOutputPath && resolvedCurrentPath !== resolvedTempPath) {
                const resources = (await fs.readdir(currentPath)).filter(file => file.endsWith(".png"));
                if (resources.length > 0) {
                    packList.push(file);
                }
            }
        }
    }
    return packList;
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

const getAtlasName = (folderName, scale) => {
    return (scales.length === 1 && scales[0] === 1) ? folderName : `${folderName}@${scale}x`;
};

const getHash = async () => {
    const list = await getFiles();
    newHash = {};

    for (const filePath of list) {
        const data = await fs.readFile(filePath);
        const hash = await filesHelper.getDataHash(data);
        newHash[filePath] = hash;
    }
    oldHash = await filesHelper.loadHash(hashPath);
};

const getAtlasMatchFiles = async (atlasPath, atlasName, atlasExtension) => {
    const outputList = [];

    const filesList = (await fs.readdir(atlasPath));

    const jsonList = filesList.filter(path => path.endsWith(".json"));
    const texturesList = filesList.filter(path => path.endsWith(`.${atlasExtension}`));

    for (const file of jsonList) {
        if (matchFileName(atlasName, appendTextureFormat ? `${atlasExtension}.json` : "json", file)) {
            outputList.push(file);
        }
    }

    for (const file of texturesList) {
        if (matchFileName(atlasName, atlasExtension, file)) {
            outputList.push(file);
        }
    }

    return outputList;
};

const matchFileName = (atlasName, atlasExtension, mathStr) => {
    return appendFileHash ?
        mathStr.match(`^${atlasName}\.([a-z0-9]{${atlasNameMaxHashLength}})\.${atlasExtension}$`) :
        mathStr === `${atlasName}.${atlasExtension}`;
};

const getAtlasConfig = async (atlasDir) => {
    const configPath = path.join(atlasDir, "config.json");
    let configData = {};

    try {
        const data = await fs.readFile(configPath, "utf-8");
        configData = JSON.parse(data);
    } catch (err) {
        //returning empty config;
    }
    return { ...defaultAtlasConfig, ...configData };
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
