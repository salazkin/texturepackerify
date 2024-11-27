const naturalCompare = require('../utils/natural-compare');
const stringUtils = require('../utils/string-utils');

const jsonHashTemplate = (data) => {
    const atlas = {
        frames: {}
    };

    for (let i = 0; i < data.blocks.length; i++) {
        let block = data.blocks[i];
        const frameId = data.spriteExtensions ? block.id : stringUtils.removeExtension(block.id);
        atlas.frames[frameId] = {
            frame: {
                x: block.frameRect.x,
                y: block.frameRect.y,
                w: block.frameRect.w,
                h: block.frameRect.h
            },
            spriteSourceSize: {
                x: Math.abs(block.spriteRect.x),
                y: Math.abs(block.spriteRect.y),
                w: block.frameRect.w,
                h: block.frameRect.h
            },
            sourceSize: {
                w: block.spriteRect.w,
                h: block.spriteRect.h
            },
            trimmed: block.trimmed,
            rotated: block.rotated
        };
    }

    if (data.animations) {
        const animations = parseAnimations(data.blocks.map(block => block.id));
        if (Object.keys(animations).length > 0) {
            atlas.animations = animations;
        }
    }

    atlas.meta = {
        app: "https://www.npmjs.com/package/texturepackerify",
        version: "1.0",
        image: `${data.atlasTextureName}${data.atlasTextureExtension}`,
        format: "RGBA8888",
        size: { w: data.atlasWidth, h: data.atlasHeight },
        scale: data.scale
    };

    return JSON.stringify(atlas, null, 2);
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

module.exports = {
    jsonHashTemplate
};
