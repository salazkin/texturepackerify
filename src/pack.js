"use strict";

const fs = require("fs/promises");
const path = require("path");
const filesHelper = require('./utils/files-helper');
const promiseUtils = require('./utils/promise-utils');
const templates = require('./templates/templates');
const sharp = require('sharp');

const MaxRectsPacker = require("maxrects-packer").MaxRectsPacker;

module.exports = async (packConfig) => {
    const {
        atlasConfig,
        scale,
        atlasDir,
        hash,
        outputDir,
        atlasName,
        appendFileHash,
        atlasNameMaxHashLength,
        textureFormat,
        formatConfig
    } = packConfig;

    const files = (await filesHelper.getFilesRecursive(atlasDir, false))
        .filter(value => value.endsWith(".png"));

    const blocks = await getBlocksData(files, atlasDir, scale, hash, atlasConfig);
    const atlasInfo = await fitBlocks(atlasConfig, blocks);
    if (!atlasInfo) {
        throw new Error(`Atlas is to big: ${atlasDir}`);
    }

    const { atlasWidth, atlasHeight } = atlasInfo;

    const atlasTextureData = await getTextureBuffer({
        atlasWidth,
        atlasHeight,
        blocks,
        removeAlpha: atlasConfig.removeAlpha,
        textureFormat,
        formatConfig
    });

    let atlasTextureHashStr = "";

    if (appendFileHash) {
        const textureHash = await filesHelper.getDataHash(atlasTextureData);
        atlasTextureHashStr = `.${textureHash.slice(0, atlasNameMaxHashLength)}`;
    }

    const atlasOutputName = `${atlasName}${atlasTextureHashStr}.${textureFormat}`;

    await sharp(atlasTextureData).toFile(path.join(outputDir, atlasOutputName));

    const atlasTextData = templates.jsonHashTemplate({
        textureName: atlasOutputName,
        atlasWidth,
        atlasHeight,
        scale,
        blocks,
        animations: atlasConfig.animations,
        spriteExtensions: atlasConfig.spriteExtensions
    });

    let atlasTextDataHashStr = "";

    if (appendFileHash) {
        const atlasHash = await filesHelper.getDataHash(atlasTextData);
        atlasTextDataHashStr = `.${atlasHash.slice(0, atlasNameMaxHashLength)}`;
    }

    const atlasTextDataOutputName = `${atlasName}${atlasTextDataHashStr}.json`;

    await fs.writeFile(path.join(outputDir, atlasTextDataOutputName), atlasTextData);
};

const getBlocksData = async (files, atlasDir, scale, hash, config) => {
    const blocks = [];
    const sprites = {};

    await promiseUtils.sequence(files.map(file => {
        return async () => {

            const imgPath = path.join(atlasDir, file);
            const imgHash = hash[imgPath];

            if (!sprites[imgHash]) {
                const imgData = { width: null, height: null, trimmed: false, trim: undefined, data: null };
                const image = sharp(imgPath);
                const { info, data } = await image.toBuffer({ resolveWithObject: true });
                Object.assign(imgData, { width: info.width, height: info.height, data });

                if (scale !== 1) {
                    const newWidth = Math.ceil(imgData.width * scale);
                    const newHeight = Math.ceil(imgData.height * scale);
                    const { data: scaledImgData } = await sharp(imgData.data).resize(newWidth, newHeight).toBuffer({ resolveWithObject: true });
                    Object.assign(imgData, { width: newWidth, height: newHeight, data: scaledImgData });
                }

                if (config.allowTrim) {
                    const { info: trimInfo, data: trimmedImgData } = await sharp(imgData.data).trim({ threshold: config.alphaThreshold }).toBuffer({ resolveWithObject: true });
                    const { trimOffsetLeft, trimOffsetTop, width: trimWidth, height: trimHeight } = trimInfo;
                    if (imgData.width !== trimWidth || imgData.height !== trimHeight) {
                        imgData.trimmed = true;
                        imgData.trim = { x: trimOffsetLeft, y: trimOffsetTop, w: trimWidth, h: trimHeight };
                        imgData.data = trimmedImgData;
                    }
                }

                sprites[imgHash] = imgData;
            }

            const { trimmed, data: imageBuffer, width, height, trim } = sprites[imgHash];
            const frameRect = { w: trim?.w ?? width, h: trim?.h ?? height };
            const spriteRect = { x: trim?.x ?? 0, y: trim?.y ?? 0, w: width, h: height };
            const extrude = isExtrude(config, file) ? 1 : 0;

            blocks.push({ id: file, frameRect, spriteRect, trimmed, rotated: false, extrude, hash: imgHash, imageBuffer });
        };
    }));

    return blocks;
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

const getTextureBuffer = async (params) => {
    const { atlasWidth: width, atlasHeight: height, blocks, removeAlpha, textureFormat, formatConfig } = params;

    const frames = [];
    blocks.forEach(block => {
        if (!block.duplicate) {
            if (block.extrude > 0) {
                frames.push(...addExtrudeData(block));
            }
            const { imageBuffer, rotated } = block;
            frames.push({ imageBuffer, left: block.frameRect.x, top: block.frameRect.y, rotated });
        }
    });

    const compositeImages = await Promise.all(
        frames.map(async ({ imageBuffer, top, left, rotated }) => {
            let input = imageBuffer;
            if (rotated) {
                input = await sharp(imageBuffer).rotate(90).toBuffer();
            }
            return { input, top, left };
        })
    );

    let buffer = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: removeAlpha ? 1 : 0 } } })
        .composite(compositeImages);

    switch (textureFormat) {
        case "jpeg":
            buffer = buffer.jpeg({ quality: formatConfig?.jpeg?.quality });
            break;
        case "webp":
            buffer = buffer.webp({ quality: formatConfig?.webp?.quality, alphaQuality: formatConfig?.webp?.alphaQuality });
            break;
        case "avif":
            buffer = buffer.avif({ quality: formatConfig?.avif?.quality });
            break;
        default:
            buffer = buffer.png();
    }

    return buffer.toBuffer();
};

const addExtrudeData = (block) => {
    const { imageBuffer, frameRect, extrude, rotated } = block;
    return [
        { imageBuffer, top: frameRect.y - extrude, left: frameRect.x - extrude, rotated },
        { imageBuffer, top: frameRect.y - extrude, left: frameRect.x + extrude, rotated },
        { imageBuffer, top: frameRect.y + extrude, left: frameRect.x - extrude, rotated },
        { imageBuffer, top: frameRect.y + extrude, left: frameRect.x + extrude, rotated },
        { imageBuffer, top: frameRect.y, left: frameRect.x + extrude, rotated },
        { imageBuffer, top: frameRect.y, left: frameRect.x - extrude, rotated },
        { imageBuffer, top: frameRect.y - extrude, left: frameRect.x, rotated },
        { imageBuffer, top: frameRect.y + extrude, left: frameRect.x, rotated }
    ];
};

const fitBlocks = (atlasConfig, blocks) => {
    const { maxWidth, maxHeight, pot, square, border, allowRotation, extraSpace } = atlasConfig;
    const packer = new MaxRectsPacker(maxWidth, maxHeight, extraSpace, { smart: true, pot, square, border, allowRotation });

    const uniq = new Set();

    const blocksWithoutDuplicates = blocks.filter(block => {
        if (uniq.has(block.hash)) {
            return false;
        }
        uniq.add(block.hash);
        return true;
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

