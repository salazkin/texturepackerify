"use strict";

const sharp = require('sharp');
const md5File = require('md5-file');

const scaleImage = async (inputPath, outputPath, scale) => {
    const { width, height } = await sharp(inputPath).metadata();
    if (!width || !height) {
        throw new Error("Unable to retrieve image dimensions.");
    }
    const newWidth = Math.ceil(width * scale);
    const newHeight = Math.ceil(height * scale);
    await sharp(inputPath)
        .resize(newWidth, newHeight)
        .toFile(outputPath);
};

const trimImage = async (inputPath, outputPath, threshold) => {
    await sharp(inputPath)
        .trim({ threshold, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toFile(outputPath);
};

const getTrimInfo = async (imagePath) => {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const { width, height } = metadata;
    const trimmedImage = await image.trim().toBuffer({ resolveWithObject: true });
    const { info: trimInfo } = trimmedImage;
    const hash = await md5File(imagePath);
    return {
        width,
        height,
        trim: {
            x: Math.abs(trimInfo.trimOffsetLeft),
            y: Math.abs(trimInfo.trimOffsetTop),
            w: trimInfo.width,
            h: trimInfo.height
        },
        hash
    };
};

const createAtlas = async (outputPath, atlasWidth, atlasHeight, blocks) => {
    let canvas = sharp({
        create: {
            width: atlasWidth,
            height: atlasHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    });
    const compositeImages = await Promise.all(
        blocks.map(async ({ imagePath, top, left }) => {
            const imageBuffer = await sharp(imagePath).toBuffer();
            return { input: imageBuffer, top, left };
        })
    );
    canvas = canvas.composite(compositeImages);
    await canvas.toFile(outputPath);
};

module.exports = {
    scaleImage,
    trimImage,
    getTrimInfo,
    createAtlas
};
