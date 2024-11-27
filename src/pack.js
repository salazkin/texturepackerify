"use strict";

const fs = require("fs/promises");
const path = require("path");
const filesHelper = require('./utils/files-helper');
const imageHelper = require('./utils/image-helper');
const promiseUtils = require('./utils/promise-utils');
const md5File = require('md5-file');
const templates = require('./templates/templates');

const MaxRectsPacker = require("maxrects-packer").MaxRectsPacker;

module.exports = async (packConfig) => {
    const defaultAtlasConfig = packConfig.defaultAtlasConfig;
    const scales = packConfig.scales;
    const atlasDir = packConfig.atlasDir;
    const tempDir = packConfig.tempDir;
    const hash = packConfig.hash;
    const files = (await filesHelper.getFilesRecursive(atlasDir, false))
        .filter(value => value.endsWith(".png"));
    const outputDir = packConfig.outputDir;
    const atlasConfig = await getAtlasConfig(atlasDir);
    const currentAtlasConfig = Object.assign({}, defaultAtlasConfig, atlasConfig);

    await promiseUtils.sequence(scales.map(scale => {
        return async () => {
            const blocks = [];

            await promiseUtils.sequence(files.map(file => {
                return async () => {

                    const tempImgHash = packConfig.hash[path.join(atlasDir, file)];

                    const scaleImgPath = path.join(atlasDir, file);
                    const scaleOutputPath = path.join(tempDir, getTempImgName(tempImgHash, scale, "scale"));

                    if (scale !== 1) {
                        try {
                            await fs.access(scaleOutputPath);
                        } catch {
                            await imageHelper.scaleImage(scaleImgPath, scaleOutputPath, scale);
                        }
                    }

                    let frameRect = null;
                    let spriteRect = null;
                    let trimmed = false;

                    const spritePath = scale === 1 ? scaleImgPath : scaleOutputPath;

                    if (currentAtlasConfig.allowTrim) {
                        const trimInfo = await imageHelper.getTrimInfo(spritePath, currentAtlasConfig.alphaThreshold);
                        frameRect = { w: trimInfo.trimRect.w, h: trimInfo.trimRect.h };
                        spriteRect = { x: trimInfo.trimRect.x, y: trimInfo.trimRect.y, w: trimInfo.imageWidth, h: trimInfo.imageHeight };
                        trimmed = trimInfo.trimmed;
                        if (trimmed) {
                            const trimOutputPath = path.join(tempDir, getTempImgName(tempImgHash, scale, "trim"));
                            try {
                                await fs.access(trimOutputPath);
                            } catch {
                                await imageHelper.trimImage(spritePath, trimOutputPath, currentAtlasConfig.alphaThreshold);
                            }
                        }
                    } else {
                        const { imageWidth, imageHeight } = await imageHelper.getImageSize(spritePath);
                        frameRect = { w: imageWidth, h: imageHeight };
                        spriteRect = { x: 0, y: 0, w: imageWidth, h: imageHeight };
                    }

                    const imgHash = await md5File(spritePath);
                    const extrude = isExtrude(currentAtlasConfig, file) ? 1 : 0;

                    blocks.push({ id: file, frameRect, spriteRect, trimmed, rotated: false, extrude, hash: imgHash });
                };
            }));

            const atlasInfo = await fitBlocks(currentAtlasConfig, blocks);
            if (!atlasInfo) {
                throw new Error(`Atlas is to big: ${atlasDir}`);
            }

            const { atlasWidth, atlasHeight } = atlasInfo;

            let textureId = atlasDir.split(path.sep).filter(Boolean).pop();
            const atlasTextureName = (scales.length === 1 && scales[0] === 1) ? textureId : `${textureId}@${scale}x`;

            const atlasData = {
                atlasDir,
                atlasWidth,
                atlasHeight,
                scale,
                blocks,
                atlasTextureName,
                atlasTextureExtension: currentAtlasConfig.jpg ? ".jpg" : ".png",
                animations: currentAtlasConfig.animations,
                spriteExtensions: currentAtlasConfig.spriteExtensions
            };

            await promiseUtils.parallel([
                async () => await saveJson(atlasData, outputDir),
                async () => await saveTexture(atlasData, hash, tempDir, outputDir)
            ]);
        };
    }));
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
    return configData;
};

const isExtrude = (atlasConfig, id) => {
    if (atlasConfig.extrude !== undefined) {
        if (Array.isArray(atlasConfig.extrude)) {
            return atlasConfig.extrude.indexOf(id) !== -1;
        } else {
            return atlasConfig.extrude;
        }
    }
    return false;
};

const saveJson = async (atlasData, outputDir) => {
    const atlasJsonPath = path.join(outputDir, `${atlasData.atlasTextureName}.json`);
    const atlasTextData = templates.jsonHashTemplate(atlasData);
    await fs.writeFile(atlasJsonPath, atlasTextData);
};

const saveTexture = async (atlasData, hash, tempDir, outputDir) => {
    const atlasTexturePath = path.join(outputDir, `${atlasData.atlasTextureName}${atlasData.atlasTextureExtension}`);

    const blocksArr = [];
    atlasData.blocks.forEach(block => {
        if (!block.duplicate) {
            const { scale } = atlasData;

            const tempImgHash = hash[path.join(atlasData.atlasDir, block.id)];

            const imagePath = (scale === 1) ?
                block.trimmed ? path.join(tempDir, getTempImgName(tempImgHash, scale, "trim")) : path.join(atlasData.atlasDir, block.id) :
                block.trimmed ? path.join(tempDir, getTempImgName(tempImgHash, scale, "trim")) : path.join(tempDir, getTempImgName(tempImgHash, scale, "scale"));

            if (block.extrude > 0) {
                blocksArr.push(...addExtrudeData(imagePath, block));
            }
            blocksArr.push({ imagePath, left: block.frameRect.x, top: block.frameRect.y, rotated: block.rotated });
        }
    });
    await imageHelper.createAtlas(atlasTexturePath, atlasData.atlasWidth, atlasData.atlasHeight, blocksArr);
};

const addExtrudeData = (imagePath, block) => {
    const { frameRect, extrude, rotated } = block;
    return [
        { imagePath, top: frameRect.y - extrude, left: frameRect.x - extrude, rotated },
        { imagePath, top: frameRect.y - extrude, left: frameRect.x + extrude, rotated },
        { imagePath, top: frameRect.y + extrude, left: frameRect.x - extrude, rotated },
        { imagePath, top: frameRect.y + extrude, left: frameRect.x + extrude, rotated },
        { imagePath, top: frameRect.y, left: frameRect.x + extrude, rotated },
        { imagePath, top: frameRect.y, left: frameRect.x - extrude, rotated },
        { imagePath, top: frameRect.y - extrude, left: frameRect.x, rotated },
        { imagePath, top: frameRect.y + extrude, left: frameRect.x, rotated }
    ];
};

const getTempImgName = (tempHashKey, scale, suffix) => {
    return `${tempHashKey}@${scale}x_${suffix}.png`;
};

const fitBlocks = (atlasConfig, blocks) => {
    const { maxWidth, maxHeight, pot, square, border, allowRotation, extraSpace } = atlasConfig;
    const packer = new MaxRectsPacker(maxWidth, maxHeight, extraSpace, { smart: true, pot, square, border, allowRotation });

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

    packer.addArray(blocksWithoutDuplicates.map(block => {
        return {
            width: block.frameRect.w + block.extrude * 2,
            height: block.frameRect.h + block.extrude * 2,
            data: block.id
        };
    }));

    if (packer.bins.length > 1) {
        return;
    }
    blocksWithoutDuplicates.forEach(block => {
        const frame = packer.bins[0].rects.find(packed => packed.data == block.id);
        block.frameRect.x = block.extrude + frame.x;
        block.frameRect.y = block.extrude + frame.y;
        block.rotated = frame.rot;
    });

    blocks.forEach(block => {
        if (!blocksWithoutDuplicates.includes(block)) {
            const updatedBlock = blocksWithoutDuplicates.find(el => el.hash === block.hash);
            block.frameRect.x = updatedBlock.frameRect.x;
            block.frameRect.y = updatedBlock.frameRect.y;
            block.rotated = updatedBlock.rotated;
            block.duplicate = true;
        }
    });

    return { blocks, atlasWidth: packer.bins[0].width, atlasHeight: packer.bins[0].height };
};

