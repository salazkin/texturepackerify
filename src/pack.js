"use strict";

const fs = require("fs/promises");
const path = require("path");
const filesHelper = require('./utils/files-helper');
const stringUtils = require('./utils/string-utils');
const naturalCompare = require('./utils/natural-compare');
const imageHelper = require('./utils/image-helper');
const promiseUtils = require('./utils/promise-utils');
const MaxRectsPacker = require("maxrects-packer").MaxRectsPacker;

let packer = null;

let atlasDir = null;
let tempDir = null;
let outputDir = null;
let blocks = [];
let files = [];
let atlas = null;
let duplicates = [];
let hash = {};
let scales = null;
let defaultAtlasConfig = null;

let currentAtlasConfig = null;
let currentScale = null;
let currentImgPath = null;

module.exports = async (packConfig) => {
    hash = packConfig.hash;
    defaultAtlasConfig = packConfig.defaultAtlasConfig;
    scales = packConfig.scales ?? [1];
    atlasDir = packConfig.atlasDir;
    tempDir = packConfig.tempDir;
    outputDir = packConfig.outputDir;
    files = (await filesHelper.getFilesRecursive(atlasDir, false))
        .filter(value => value.endsWith(".png"));

    const atlasConfig = await getAtlasConfig();
    currentAtlasConfig = Object.assign({}, defaultAtlasConfig, atlasConfig);

    await promiseUtils.sequence(scales.map(scale => {
        return async () => {
            blocks = [];
            duplicates = [];
            currentScale = scale;
            packer = getNewPacker();
            await promiseUtils.sequence(files.map(file => {
                return async () => {
                    currentImgPath = file;
                    await scaleImg();
                    await trimImg();
                };
            }));
            await buildAtlas();
        };
    }));
};

const getAtlasConfig = async () => {
    const configPath = path.join(atlasDir, "config.json");
    let configData = {};

    try {
        const data = await fs.readFile(configPath, "utf-8");
        configData = JSON.parse(data);
    } catch (err) {
        //returning empty config;
    }
    return configData;
};

const scaleImg = async () => {
    const name = getTempImgName(currentImgPath, "scale");
    const outputPath = path.join(tempDir, name);
    if (currentScale !== 1) {
        try {
            await fs.access(outputPath);
        } catch {
            await imageHelper.scaleImage(path.join(atlasDir, currentImgPath), outputPath, currentScale);
        }
    }
};

const trimImg = async () => {
    const name = getTempImgName(currentImgPath, "trim");
    const imgPath = currentScale === 1
        ? path.join(atlasDir, currentImgPath)
        : path.join(tempDir, getTempImgName(currentImgPath, "scale"));

    const data = await imageHelper.getTrimInfo(imgPath);
    const block = { id: currentImgPath };
    const extrudeSpace = isExtrude(currentImgPath) ? 2 : 0;

    block.width = data.width + extrudeSpace;
    block.height = data.height + extrudeSpace;
    block.x = data.trim.x;
    block.y = data.trim.y;
    block.w = data.trim.w + extrudeSpace;
    block.h = data.trim.h + extrudeSpace;
    block.hash = data.hash;
    block.trim = (data.width !== data.trim.w || data.height !== data.trim.h);
    blocks.push(block);

    const outputPath = path.join(tempDir, name);
    if (block.trim) {
        try {
            await fs.access(outputPath);
        } catch {
            await imageHelper.trimImage(imgPath, outputPath, currentAtlasConfig.alphaThreshold);
        }
    }
};

const isExtrude = (id) => {
    if (currentAtlasConfig.extrude !== undefined) {
        if (Array.isArray(currentAtlasConfig.extrude)) {
            return currentAtlasConfig.extrude.indexOf(id) !== -1;
        } else {
            return currentAtlasConfig.extrude;
        }
    }
    return false;
};

const buildAtlas = async () => {
    fitBlocks();

    atlas = {
        frames: {}
    };
    for (let i = 0; i < blocks.length; i++) {
        let block = blocks[i];
        let extrudeSpace = isExtrude(block.id) ? 1 : 0;
        atlas.frames[block.id] = {
            frame: {
                x: block.fit.x + extrudeSpace,
                y: block.fit.y + extrudeSpace,
                w: block.w - (extrudeSpace * 2),
                h: block.h - (extrudeSpace * 2)
            },
            spriteSourceSize: {
                x: block.x,
                y: block.y,
                w: block.w - (extrudeSpace * 2),
                h: block.h - (extrudeSpace * 2)
            },
            sourceSize: {
                w: block.width - (extrudeSpace * 2),
                h: block.height - (extrudeSpace * 2)
            },
            trimmed: block.trim
        };
    }

    if (currentAtlasConfig.animations) {
        const animations = parseAnimations(Object.keys(atlas.frames));
        if (Object.keys(animations).length > 0) {
            atlas.animations = animations;
        }
    }

    let atlasWidth = packer.bins[0].width;
    let atlasHeight = packer.bins[0].height;

    const ext = currentAtlasConfig.jpg ? ".jpg" : ".png";

    atlas.meta = {
        app: "http://www.texturepacker.com",
        version: "1.0",
        image: getOutputAtlasName() + ext,
        format: "RGBA8888",
        size: { w: atlasWidth, h: atlasHeight },
        scale: currentScale
    };
    await saveJson();
    await saveTexture();
};

const saveJson = async () => {
    let framesWithoutExtensions = null;
    if (!currentAtlasConfig.spriteExtensions) {
        framesWithoutExtensions = {};
        for (let key in atlas.frames) {
            framesWithoutExtensions[stringUtils.removeExtension(key)] = atlas.frames[key];
        }
    }

    let framesStr = stringUtils.orderedStringify(framesWithoutExtensions || atlas.frames);
    if (framesStr.length > 2) {
        framesStr = framesStr.substring(1, framesStr.length - 2);
        framesStr = framesStr.replace(/"frame"/g, `\n\t\t\t"frame"`);
        framesStr = framesStr.replace(/"sourceSize"/g, `\n\t\t\t"sourceSize"`);
        framesStr = framesStr.replace(/"spriteSourceSize"/g, `\n\t\t\t"spriteSourceSize"`);
        framesStr = framesStr.replace(/"trimmed"/g, `\n\t\t\t"trimmed"`);
        framesStr = framesStr.replace(/true},/g, `true\n\t\t},\n\t\t`);
        framesStr = framesStr.replace(/false},/g, `false\n\t\t},\n\t\t`);
    }

    let animationsStr = atlas.animations ? stringUtils.orderedStringify(atlas.animations) : "";
    if (animationsStr.length > 2) {
        animationsStr = animationsStr.substring(1, animationsStr.length - 1);
        animationsStr = animationsStr.replace(/],/g, `],\n\t\t`);
        animationsStr = `\n\t"animations":{\n\t\t${animationsStr}\n\t},`;
    } else {
        animationsStr = "";
    }

    let metaStr = JSON.stringify(atlas.meta);
    metaStr = metaStr.substring(1, metaStr.length - 1);

    for (const metaId in atlas.meta) {
        metaStr = metaStr.replace(new RegExp(`"${metaId}"`, "g"), `\n\t\t"${metaId}"`);
    }
    let atlasStr = `{\n\t"frames":{\n\t\t${framesStr}\n\t\t}\n\t},${animationsStr}\n\t"meta":{${metaStr}\n\t}\n}`;
    atlasStr = atlasStr.replace(/\t/g, `  `);

    const atlasJsonPath = path.join(outputDir, `${getOutputAtlasName()}.json`);
    await fs.writeFile(atlasJsonPath, atlasStr);
};

const saveTexture = async () => {
    const blocksArr = [];
    for (const id in atlas.frames) {
        if (!duplicates.includes(id)) {
            const frame = atlas.frames[id].frame;
            const img = getImageSource(id, atlas.frames[id].trimmed);
            if (isExtrude(id)) {
                blocksArr.push(...addExtrudeData(img, frame));
            }
            blocksArr.push({ imagePath: img, top: frame.y, left: frame.x });
        }
    }
    const outputPath = path.join(outputDir, `${getOutputAtlasName()}${currentAtlasConfig.jpg ? ".jpg" : ".png"}`);
    await imageHelper.createAtlas(outputPath, atlas.meta.size.w, atlas.meta.size.h, blocksArr);
};

const addExtrudeData = (imagePath, frame) => {
    return [
        { imagePath, top: frame.y - 1, left: frame.x - 1 },
        { imagePath, top: frame.y - 1, left: frame.x + 1 },
        { imagePath, top: frame.y + 1, left: frame.x - 1 },
        { imagePath, top: frame.y + 1, left: frame.x + 1 },
        { imagePath, top: frame.y, left: frame.x + 1 },
        { imagePath, top: frame.y, left: frame.x - 1 },
        { imagePath, top: frame.y - 1, left: frame.x },
        { imagePath, top: frame.y + 1, left: frame.x }
    ];
};

const getImageSource = (id, trimmed) => {
    if (currentScale === 1) {
        return trimmed ? path.join(tempDir, getTempImgName(id, "trim")) : path.join(atlasDir, id);
    } else {
        return trimmed ? path.join(tempDir, getTempImgName(id, "trim")) : path.join(tempDir, getTempImgName(id, "scale"));
    }
};

const getTempImgName = (id, suffix) => {
    return `${hash[path.join(atlasDir, id)]}@${currentScale}x_${suffix}.png`;
};

const getOutputAtlasName = () => {
    let textureId = atlasDir.split(path.sep).filter(Boolean).pop();
    return scales.length > 1 ? `${textureId}@${currentScale}x` : textureId;
};
const getNewPacker = () => {
    return new MaxRectsPacker(4096, 4096, currentAtlasConfig.extraSpace, { smart: true, pot: currentAtlasConfig.pot, square: currentAtlasConfig.square, border: currentAtlasConfig.border });
};

const fitBlocks = () => {
    blocks.sort((a, b) => { return Math.max(b.w, b.h) - Math.max(a.w, a.h); });
    blocks.sort((a, b) => { Math.min(b.w, b.h) - Math.min(a.w, a.h); });
    blocks.sort((a, b) => { return b.h - a.h; });
    blocks.sort((a, b) => { return b.w - a.w; });
    const uniq = new Set();
    const blocksWithoutDuplicates = blocks.filter(block => {
        if (!uniq.has(block.hash)) {
            uniq.add(block.hash);
            return block;
        }
    });

    const fullNotation = blocksWithoutDuplicates.map(block => {
        const newBlock = {};
        newBlock.width = block.w;
        newBlock.height = block.h;
        newBlock.data = block.id;
        return newBlock;
    });

    packer.addArray(fullNotation);

    blocksWithoutDuplicates.forEach(e => {
        const fitted = packer.bins[0].rects.find(packed => packed.data == e.id);
        e.fit = { x: fitted.x, y: fitted.y };
    });

    blocks.forEach(block => {
        if (!block.fit) {
            blocksWithoutDuplicates.forEach(fitBlock => {
                if (fitBlock.hash === block.hash) {
                    block.fit = fitBlock.fit;
                    block.isDuplicate = true;
                    duplicates.push(block.id);
                    return true;
                }
            });
        }
    });
};

const parseAnimations = (keys) => {
    const anims = {};
    const sequenceArr = [...keys].sort(naturalCompare);

    const trimLastChars = "/_-";
    for (let i = 0; i < sequenceArr.length; i++) {
        const split = stringUtils.parseSequenceString(sequenceArr[i]);

        let id = split.prefix;
        if (id.length > 0 && trimLastChars.indexOf(id[id.length - 1]) !== -1) {
            id = id.substring(0, id.length - 1);
        }

        if (id.length > 0 && split.suffix && i < sequenceArr.length - 1 && split.prefix + split.suffixIncremented + split.extension === sequenceArr[i + 1]) {
            if (anims[id] === undefined) {
                anims[id] = [sequenceArr[i]];
            }
            anims[id].push(sequenceArr[i + 1]);
        }
    }
    return anims;
};


