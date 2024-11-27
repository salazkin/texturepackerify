"use strict";

const sharp = require('sharp');

const scaleImage = async (inputPath, outputPath, scale) => {
    const { width, height } = await sharp(inputPath).metadata();
    const newWidth = Math.ceil(width * scale);
    const newHeight = Math.ceil(height * scale);
    await sharp(inputPath)
        .resize(newWidth, newHeight)
        .toFile(outputPath);
};

const getImageSize = async (inputPath) => {
    const { width, height } = await sharp(inputPath).metadata();
    return { imageWidth: width, imageHeight: height };
};

const trimImage = async (inputPath, outputPath, threshold) => {
    await sharp(inputPath)
        .trim({ threshold, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toFile(outputPath);
};

const getTrimInfo = async (imagePath, threshold) => {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const { width, height } = metadata;
    const trimmedImage = await image.trim({ threshold }).toBuffer({ resolveWithObject: true });
    const { info: trimInfo } = trimmedImage;

    const trimmed = (width !== trimInfo.width || height !== trimInfo.height);
    const out = { imageWidth: width, imageHeight: height, trimmed };

    out.trimRect = {
        x: trimInfo.trimOffsetLeft,
        y: trimInfo.trimOffsetTop,
        w: trimInfo.width,
        h: trimInfo.height
    };

    return out;
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
        blocks.map(async ({ imagePath, top, left, rotated }) => {
            let image = await sharp(imagePath);
            if (rotated) {
                image = image.rotate(90);
            }
            const imageBuffer = await image.toBuffer();
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
    createAtlas,
    getImageSize
};
