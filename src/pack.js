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

                    const trimImgPath = scale === 1 ? scaleImgPath : scaleOutputPath;
                    const trimImgInfo = await imageHelper.getTrimInfo(trimImgPath, currentAtlasConfig.alphaThreshold);

                    const trim = (trimImgInfo.imageWidth !== trimImgInfo.trim.w || trimImgInfo.imageHeight !== trimImgInfo.trim.h);

                    if (trim) {
                        const trimOutputPath = path.join(tempDir, getTempImgName(tempImgHash, scale, "trim"));
                        try {
                            await fs.access(trimOutputPath);
                        } catch {
                            await imageHelper.trimImage(trimImgPath, trimOutputPath, currentAtlasConfig.alphaThreshold);
                        }
                    }

                    const trimImgHash = await md5File(trimImgPath);
                    const extrude = isExtrude(currentAtlasConfig, file) ? 1 : 0;

                    blocks.push({
                        id: file,
                        frame: { w: trimImgInfo.trim.w, h: trimImgInfo.trim.h },
                        sprite: { x: trimImgInfo.trim.x, y: trimImgInfo.trim.y, w: trimImgInfo.imageWidth, h: trimImgInfo.imageHeight },
                        trimmed: trim,
                        extrude,
                        hash: trimImgHash
                    });
                };
            }));

            const { atlasWidth, atlasHeight } = await fitBlocks(currentAtlasConfig, blocks);

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
            blocksArr.push({ imagePath, left: block.frame.x, top: block.frame.y });
        }
    });

    await imageHelper.createAtlas(atlasTexturePath, atlasData.atlasWidth, atlasData.atlasHeight, blocksArr);
};

const addExtrudeData = (imagePath, block) => {
    const { frame, extrude } = block;
    return [
        { imagePath, top: frame.y - extrude, left: frame.x - extrude },
        { imagePath, top: frame.y - extrude, left: frame.x + extrude },
        { imagePath, top: frame.y + extrude, left: frame.x - extrude },
        { imagePath, top: frame.y + extrude, left: frame.x + extrude },
        { imagePath, top: frame.y, left: frame.x + extrude },
        { imagePath, top: frame.y, left: frame.x - extrude },
        { imagePath, top: frame.y - extrude, left: frame.x },
        { imagePath, top: frame.y + extrude, left: frame.x }
    ];
};

const getTempImgName = (tempHashKey, scale, suffix) => {
    return `${tempHashKey}@${scale}x_${suffix}.png`;
};

const fitBlocks = (atlasConfig, blocks) => {
    const packer = new MaxRectsPacker(4096, 4096, atlasConfig.extraSpace, { smart: true, pot: atlasConfig.pot, square: atlasConfig.square, border: atlasConfig.border });

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
            width: block.frame.w + block.extrude * 2,
            height: block.frame.h + block.extrude * 2,
            data: block.id
        };
    }));

    blocksWithoutDuplicates.forEach(block => {
        const frame = packer.bins[0].rects.find(packed => packed.data == block.id);
        block.frame.x = block.extrude + frame.x;
        block.frame.y = block.extrude + frame.y;
        block.rotated = false;
    });

    blocks.forEach(block => {
        if (!blocksWithoutDuplicates.includes(block)) {
            const updatedBlock = blocksWithoutDuplicates.find(el => el.hash === block.hash);
            block.frame.x = updatedBlock.frame.x;
            block.frame.y = updatedBlock.frame.y;
            block.rotated = updatedBlock.rotated;
            block.duplicate = true;
        }
    });

    return { blocks, atlasWidth: packer.bins[0].width, atlasHeight: packer.bins[0].height };
};

