"use strict";

const fs = require("fs");
const exec = require("child_process").exec;
const filesHelper = require('./utils/files-helper');
const stringUtils = require('./utils/string-utils');
const naturalCompare = require('./utils/natural-compare');

const MaxRectsPacker = require("maxrects-packer").MaxRectsPacker;
let packer = null;
let done = null;
let tempFolderPath = filesHelper.getTempFolderPath();
let offset = 2;
let src = "";
let blocks = [];
let files = [];
let atlas = null;
let duplicates = {};
let hash = {};
let scales = null;
let defaultAtlasConfig = null;

let currentAtlasConfig = null;
let currentScaleIndex = 0;
let currentScale = 1;
let currentFileIndex = 0;
let currentImg = null;

module.exports = (packConfig, cb) => {
    hash = packConfig.hash;
    defaultAtlasConfig = packConfig.defaultAtlasConfig;
    scales = packConfig.scales || [1];

    src = packConfig.src;

    done = cb;
    blocks = [];
    duplicates = {};
    files = filesHelper.getFilesRecursive(src + "/", false).filter(value => value.indexOf(".png") > -1);
    if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
    }
    readConfig();
};


const readConfig = () => {
    if (fs.existsSync(src + "/config.json")) {
        fs.readFile(src + "/config.json", "utf-8", (err, data) => {
            initPacker(JSON.parse(data));
        });
    } else {
        initPacker({});
    }
};

const initPacker = (config) => {
    currentAtlasConfig = Object.assign({}, defaultAtlasConfig, config);
    currentFileIndex = 0;
    currentScaleIndex = 0;
    currentScale = scales[currentScaleIndex];
    packer = getNewPacker();
    prepareNextImg();
};

const prepareNextImg = () => {
    if (currentFileIndex >= files.length) {
        buildAtlas();
        return;
    }
    currentImg = files[currentFileIndex];
    currentFileIndex++;
    scaleImg();
};

const scaleImg = () => {
    let name = getTempImgName(currentImg, "scale");

    if (currentScale !== 1 && !fs.existsSync(tempFolderPath + "/" + name)) {
        exec("convert -background none \"" + src + "/" + currentImg + `\" -resize ${100 * currentScale}% ` + tempFolderPath + "/" + name, (err, stdout, stderr) => {
            if (err || stderr) {
                console.log(err, stderr);
            }
            trimImg();
        });
    } else {
        trimImg();
    }
};

const trimImg = () => {
    let name = getTempImgName(currentImg, "trim");
    let imgPath = currentScale === 1 ? src + "/" + currentImg : tempFolderPath + "/" + getTempImgName(currentImg, "scale");

    exec("convert \"" + imgPath + "\" -border " + offset + "x" + offset + " -trim -format \"%W %H %X %Y %w %h %#\" info:-", (err, stdout, stderr) => {
        if (err || stderr) {
            console.log(err, stderr);
        }
        let data = stdout.split(" ");
        let block = { id: currentImg };
        let extrudeSpace = isExtrude(currentImg) ? 2 : 0;

        block.width = Number(data[0]) - offset * 2 + currentAtlasConfig.extraSpace + extrudeSpace;
        block.height = Number(data[1]) - offset * 2 + currentAtlasConfig.extraSpace + extrudeSpace;
        block.x = Number(data[2]) - offset;
        block.y = Number(data[3]) - offset;
        block.w = Number(data[4]) + currentAtlasConfig.extraSpace + extrudeSpace;
        block.h = Number(data[5]) + currentAtlasConfig.extraSpace + extrudeSpace;
        block.hash = data[6];

        block.trim = (block.width !== block.w || block.height !== block.h);
        blocks.push(block);

        if (block.trim && !fs.existsSync(tempFolderPath + "/" + name)) {
            exec("convert -background none \"" + imgPath + "\" -bordercolor none -border " + offset + "x" + offset + " -trim " + tempFolderPath + "/" + name, (err, stdout, stderr) => {
                if (err || stderr) {
                    console.log(err, stderr);
                }
                prepareNextImg();
            });
        } else {
            prepareNextImg();
        }
    });
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

const buildAtlas = () => {
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
                w: block.w - currentAtlasConfig.extraSpace - (extrudeSpace * 2),
                h: block.h - currentAtlasConfig.extraSpace - (extrudeSpace * 2)
            },
            spriteSourceSize: {
                x: block.x,
                y: block.y,
                w: block.w - currentAtlasConfig.extraSpace - (extrudeSpace * 2),
                h: block.h - currentAtlasConfig.extraSpace - (extrudeSpace * 2)
            },
            sourceSize: {
                w: block.width - currentAtlasConfig.extraSpace - (extrudeSpace * 2),
                h: block.height - currentAtlasConfig.extraSpace - (extrudeSpace * 2)
            },
            trimmed: block.trim,
            dup: block.isDuplicate
        };
    }

    if (currentAtlasConfig.animations) {
        atlas.animations = parseAnimations(Object.keys(atlas.frames));
    }

    let atlasWidth = packer.bins[0].width;
    let atlasHeight = packer.bins[0].height;

    if (!currentAtlasConfig.pot) {
        atlasWidth -= currentAtlasConfig.extraSpace;
        atlasHeight -= currentAtlasConfig.extraSpace;
    }
    let ext = currentAtlasConfig.jpg ? ".jpg" : ".png";

    atlas.meta = {
        app: "http://www.texturepacker.com",
        version: "1.0",
        image: getExportAtlasName() + ext,
        format: "RGBA8888",
        size: { w: atlasWidth, h: atlasHeight },
        scale: currentScale
    };

    if (fs.existsSync(src + "/frames.json")) {
        fs.readFile(src + "/frames.json", "utf-8", (err, data) => {
            duplicates = JSON.parse(data);
            for (let duplicateId in duplicates) {
                let duplicateData = duplicates[duplicateId];
                atlas.frames[duplicateId] = JSON.parse(JSON.stringify(atlas.frames[duplicateData.id]));
                atlas.frames[duplicateId].spriteSourceSize.x += duplicateData.offsetX;
                atlas.frames[duplicateId].spriteSourceSize.y += duplicateData.offsetY;
            }
            saveJson();
        });
    } else {
        saveJson();
    }
};

const saveJson = () => {
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
        framesStr = framesStr.replace(/"frame"/g, "\n\t\t\"frame\"");
        framesStr = framesStr.replace(/"spriteSourceSize"/g, "\n\t\t\"spriteSourceSize\"");
        framesStr = framesStr.replace(/"sourceSize"/g, "\n\t\t\"sourceSize\"");
        framesStr = framesStr.replace(/"trimmed"/g, "\n\t\t\"trimmed\"");
        framesStr = framesStr.replace(/}},/g, "}\n\t},\n\t");
        framesStr = framesStr.replace(/true},/g, "true\n\t},\n\t");
        framesStr = framesStr.replace(/false},/g, "false\n\t},\n\t");
    }

    let animationsStr = atlas.animations ? stringUtils.orderedStringify(atlas.animations) : "";
    if (animationsStr.length > 2) {
        animationsStr = animationsStr.substring(1, animationsStr.length - 1);
        animationsStr = animationsStr.replace(/],/g, "],\n\t");
        animationsStr = "\n\"animations\":{\n\t" + animationsStr + "\n},";
    }

    let metaStr = JSON.stringify(atlas.meta);
    metaStr = metaStr.substring(1, metaStr.length - 1);

    for (let metaId in atlas.meta) {
        metaStr = metaStr.replace(new RegExp("\"" + metaId + "\"", "g"), "\n\t\"" + metaId + "\"");
    }
    let atlasStr = "{\"frames\":{\n\t" + framesStr + "\n\t}\n}," + animationsStr + "\n\"meta\":{" + metaStr + "\n}\n}";
    fs.writeFile(getExportAtlasPath() + "/" + getExportAtlasName() + ".json", atlasStr, saveBlocksData);
};

const saveBlocksData = () => {
    let blocksStr = "";
    for (let id in atlas.frames) {
        if (duplicates[id] === undefined && !atlas.frames[id].dup) {
            let frame = atlas.frames[id].frame;

            let img = getImageSource(id, atlas.frames[id].trimmed);
            if (isExtrude(id)) {
                blocksStr += addExtrudeData(img, frame);
            }
            blocksStr += " \"" + img + "\" -geometry +" + frame.x + "+" + frame.y + " -composite";
        }
    }
    fs.writeFile("blocks.txt", blocksStr, saveTexture);
};

const getImageSource = (id, trimmed) => {
    if (currentScale === 1) {
        return trimmed ? tempFolderPath + "/" + getTempImgName(id, "trim") : src + "/" + id;
    } else {
        return trimmed ? tempFolderPath + "/" + getTempImgName(id, "trim") : tempFolderPath + "/" + getTempImgName(id, "scale");
    }
};

const getTempImgName = (id, suffix) => {
    return hash[src + "/" + id] + `@${currentScale}x_${suffix}` + ".png";
};

const addExtrudeData = (img, frame) => {
    let str = "";
    str += " " + img + " -geometry +" + (frame.x - 1) + "+" + (frame.y - 1) + " -composite";
    str += " " + img + " -geometry +" + (frame.x + 1) + "+" + (frame.y - 1) + " -composite";
    str += " " + img + " -geometry +" + (frame.x - 1) + "+" + (frame.y + 1) + " -composite";
    str += " " + img + " -geometry +" + (frame.x + 1) + "+" + (frame.y + 1) + " -composite";
    str += " " + img + " -geometry +" + (frame.x + 1) + "+" + frame.y + " -composite";
    str += " " + img + " -geometry +" + (frame.x - 1) + "+" + frame.y + " -composite";
    str += " " + img + " -geometry +" + frame.x + "+" + (frame.y - 1) + " -composite";
    str += " " + img + " -geometry +" + frame.x + "+" + (frame.y + 1) + " -composite";
    return str;
};

const getAtlasFolderName = () => {
    return src.split("/").pop();
};

const getExportAtlasName = () => {
    let textureId = getAtlasFolderName();
    return scales.length > 1 ? textureId + `@${currentScale}x` : textureId;
};

const getExportAtlasPath = () => {
    let arr = src.split("/");
    arr.length = arr.length - 1;
    return arr.join("/");
};

const saveTexture = () => {
    let ext = currentAtlasConfig.jpg ? ".jpg" : ".png";
    let cmd = [
        "convert",
        "-size",
        atlas.meta.size.w + "x" + atlas.meta.size.h,
        "xc:transparent",
        "@blocks.txt",
        "-depth " + currentAtlasConfig.colorDepth,
        getExportAtlasPath() + "/" + getExportAtlasName() + ext
    ];

    exec(cmd.join(" "), (err, stdout, stderr) => {
        if (stderr) {
            console.log(stderr);
        }
        fs.unlinkSync("blocks.txt");
        onPackComplete();
    });
};

const onPackComplete = () => {
    if (currentScaleIndex < scales.length - 1) {
        currentScaleIndex++;
        currentScale = scales[currentScaleIndex];
        currentFileIndex = 0;
        blocks = [];
        packer = getNewPacker();
        prepareNextImg();
    } else {
        filesHelper.clearTempFolderIfOversized();
        done();
    }
};

const getNewPacker = () => {
    return new MaxRectsPacker(4096, 4096, currentAtlasConfig.extraSpace, { smart: true, pot: currentAtlasConfig.pot, square: currentAtlasConfig.square });
};


const fitBlocks = () => {
    blocks.sort((a, b) => { return Math.max(b.w, b.h) - Math.max(a.w, a.h); });
    blocks.sort((a, b) => { Math.min(b.w, b.h) - Math.min(a.w, a.h); });
    blocks.sort((a, b) => { return b.h - a.h; });
    blocks.sort((a, b) => { return b.w - a.w; });
    let uniq = new Set();
    let blocksWithoutDups = blocks.filter(block => {
        if (!uniq.has(block.hash)) {
            uniq.add(block.hash);
            return block;
        }
    });

    let fullNotation = blocksWithoutDups.map(block => {
        let newBlock = {};
        newBlock.width = block.w;
        newBlock.height = block.h;
        newBlock.data = block.id;
        return newBlock;
    });

    packer.addArray(fullNotation);

    blocksWithoutDups.forEach(e => {
        let fitted = packer.bins[0].rects.find(packed => packed.data == e.id);
        e.fit = { x: fitted.x, y: fitted.y };
    });

    blocks.forEach(block => {
        if (!block.fit) {
            blocksWithoutDups.forEach(fitBlock => {
                if (fitBlock.hash === block.hash) {
                    block.fit = fitBlock.fit;
                    block.isDuplicate = true;
                    return true;
                }
            });
        }
    });
};


const parseAnimations = (keys) => {
    let anims = {};
    let sequenceArr = [...keys].sort(naturalCompare);

    let trimLastChars = "/_-";
    for (let i = 0; i < sequenceArr.length; i++) {
        let split = stringUtils.parseSequenceString(sequenceArr[i]);

        let id = split.preffix;
        if (id.length > 0 && trimLastChars.indexOf(id[id.length - 1]) !== -1) {
            id = id.substring(0, id.length - 1);
        }

        if (id.length > 0 && split.suffix && i < sequenceArr.length - 1 && split.preffix + split.suffixIncremented + split.extension === sequenceArr[i + 1]) {
            if (anims[id] === undefined) {
                anims[id] = [sequenceArr[i]];
            }
            anims[id].push(sequenceArr[i + 1]);
        }
    }
    return anims;

};


