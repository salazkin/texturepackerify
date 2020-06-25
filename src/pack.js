"use strict";

const fs = require("fs");
const exec = require("child_process").exec;
const tmpdir = require('os').tmpdir();
const MaxRectsPacker = require("maxrects-packer").MaxRectsPacker;
let packer = null;
let done = null;
let tmp = "";
let offset = 2;
let src = "";
let blocks = [];
let files = [];
let atlas = null;
let duplicates = {};
let hash = {};
let scales = null;

let extraSpace, jpg, pot, square, colorDepth, extrude;
let currentScaleIndex = 0;
let currentScale = 1;
let currentFileIndex = 0;
let currentImg = null;

module.exports = function (packConfig, cb) {
    hash = packConfig.hash;
    scales = packConfig.scales || [1];
    src = packConfig.src;

    tmp = tmpdir + "/tp-tmp";

    done = cb;
    blocks = [];
    duplicates = {};
    files = fs.readdirSync(src).filter((value) => value.indexOf(".png") > -1);

    if (!fs.existsSync(tmp)) {
        fs.mkdirSync(tmp);
    }

    readConfig();
};

function readConfig() {
    if (fs.existsSync(src + "/config.json")) {
        fs.readFile(src + "/config.json", "utf-8", function (err, data) {
            initPacker(JSON.parse(data));
        });
    } else {
        initPacker({});
    }
}

function initPacker(config) {

    extraSpace = config.extraSpace || 2;
    jpg = config.jpg || false;
    extrude = config.extrude || false;
    pot = config.pot || true;
    square = config.square || false;
    colorDepth = config.colorDepth || 8;
    currentFileIndex = 0;
    currentScaleIndex = 0;
    currentScale = scales[currentScaleIndex];
    packer = getNewPacker();
    prepareNextImg();
}

function prepareNextImg() {
    if (currentFileIndex >= files.length) {
        buildAtlas();
        return;
    }
    currentImg = files[currentFileIndex];
    currentFileIndex++;
    scaleImg();
}

function scaleImg() {
    let name = getTempImgName(currentImg, "scale");

    if (currentScale !== 1 && !fs.existsSync(tmp + "/" + name)) {
        exec("convert -background none " + src + "/" + currentImg + ` -resize ${100 * currentScale}% ` + tmp + "/" + name, (err, stdout, stderr) => {
            if (err || stderr) {
                console.log(err, stderr);
            }
            trimImg();
        });
    } else {
        trimImg();
    }
}

function trimImg() {
    let name = getTempImgName(currentImg, "trim");
    let imgPath = currentScale === 1 ? src + "/" + currentImg : tmp + "/" + getTempImgName(currentImg, "scale");
    exec("convert " + imgPath + " -border " + offset + "x" + offset + " -trim -format \"%W %H %X %Y %w %h %#\" info:-", (err, stdout, stderr) => {
        if (err || stderr) {
            console.log(err, stderr);
        }
        let data = stdout.split(" ");
        let block = { id: currentImg };
        let extrudeSpace = isExtrude(currentImg) ? 2 : 0;

        block.width = Number(data[0]) - offset * 2 + extraSpace + extrudeSpace;
        block.height = Number(data[1]) - offset * 2 + extraSpace + extrudeSpace;
        block.x = Number(data[2]) - offset;
        block.y = Number(data[3]) - offset;
        block.w = Number(data[4]) + extraSpace + extrudeSpace;
        block.h = Number(data[5]) + extraSpace + extrudeSpace;
        block.hash = data[6];

        block.trim = (block.width !== block.w || block.height !== block.h);
        blocks.push(block);

        if (block.trim && !fs.existsSync(tmp + "/" + name)) {
            exec("convert -background none " + imgPath + " -bordercolor none -border " + offset + "x" + offset + " -trim " + tmp + "/" + name, (err, stdout, stderr) => {
                if (err || stderr) {
                    console.log(err, stderr);
                }
                prepareNextImg();
            });
        } else {
            prepareNextImg();
        }
    });
}

function isExtrude(id) {
    if (extrude !== undefined) {
        if (Array.isArray(extrude)) {
            return extrude.indexOf(id) !== -1;
        } else {
            return extrude;
        }
    }
    return false;
}

function buildAtlas() {
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
                w: block.w - extraSpace - (extrudeSpace * 2),
                h: block.h - extraSpace - (extrudeSpace * 2)
            },
            spriteSourceSize: {
                x: block.x,
                y: block.y,
                w: block.w - extraSpace - (extrudeSpace * 2),
                h: block.h - extraSpace - (extrudeSpace * 2)
            },
            sourceSize: {
                w: block.width - extraSpace - (extrudeSpace * 2),
                h: block.height - extraSpace - (extrudeSpace * 2)
            },
            trimmed: block.trim,
            dup: block.isDuplicate
        };
    }

    let atlasWidth = packer.bins[0].width;
    let atlasHeight = packer.bins[0].height;

    if (!pot) {
        atlasWidth -= extraSpace;
        atlasHeight -= extraSpace;
    }
    let ext = jpg ? ".jpg" : ".png";
    atlas.meta = {
        app: "http://www.texturepacker.com",
        version: "1.0",
        image: getExportAtlasName() + ext,
        format: "RGBA8888",
        size: { w: atlasWidth, h: atlasHeight },
        scale: currentScale
    };

    if (fs.existsSync(src + "/frames.json")) {
        fs.readFile(src + "/frames.json", "utf-8", function (err, data) {
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
}

function saveJson() {
    let framesStr = orderedStringify(atlas.frames);
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

    let metaStr = JSON.stringify(atlas.meta);
    metaStr = metaStr.substring(1, metaStr.length - 1);

    for (let metaId in atlas.meta) {
        metaStr = metaStr.replace(new RegExp("\"" + metaId + "\"", "g"), "\n\t\"" + metaId + "\"");
    }

    let atlasStr = "{\"frames\":{\n\t" + framesStr + "\n\t}\n},\n\"meta\":{" + metaStr + "\n}\n}";
    fs.writeFile(getExportAtlasPath() + "/" + getExportAtlasName() + ".json", atlasStr, saveBlocksData);
}

function saveBlocksData() {
    let blocksStr = "";
    for (let id in atlas.frames) {
        if (duplicates[id] === undefined && !atlas.frames[id].dup) {
            let frame = atlas.frames[id].frame;

            let img = getImageSource(id, atlas.frames[id].trimmed);
            if (isExtrude(id)) {
                blocksStr += addExtrudeData(img, frame);
            }
            blocksStr += " " + img + " -geometry +" + frame.x + "+" + frame.y + " -composite";
        }
    }
    fs.writeFile("blocks.txt", blocksStr, saveTexture);
}


function getImageSource(id, trimmed) {
    if (currentScale === 1) {
        return trimmed ? tmp + "/" + getTempImgName(id, "trim") : src + "/" + id;
    } else {
        return trimmed ? tmp + "/" + getTempImgName(id, "trim") : tmp + "/" + getTempImgName(id, "scale");
    }
}

function getTempImgName(id, suffix) {
    return hash[src + "/" + id] + `@${currentScale}x_${suffix}` + ".png";
}

function addExtrudeData(img, frame) {
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
}

function getExportAtlasName() {
    let textureId = src.split("/").pop();
    return scales.length > 1 ? textureId + `@${currentScale}x` : textureId;
}

function getExportAtlasPath() {
    let arr = src.split("/");
    arr.length = arr.length - 1;
    return arr.join("/");
}

function saveTexture() {
    let ext = jpg ? ".jpg" : ".png";
    let cmd = [
        "convert",
        "-size",
        atlas.meta.size.w + "x" + atlas.meta.size.h,
        "xc:transparent",
        "@blocks.txt",
        "-depth " + colorDepth,
        getExportAtlasPath() + "/" + getExportAtlasName() + ext
    ];

    exec(cmd.join(" "), (err, stdout, stderr) => {
        if (stderr) {
            console.log(stderr);
        }
        fs.unlinkSync("blocks.txt");
        if (fs.existsSync(tmp)) {
            let size = 0;
            fs.readdirSync(tmp).forEach((file, index) => {
                size += fs.statSync(tmp + "/" + file).size;
            });
            if (size / 1024 / 1024 > 100) {
                clearTmp();
            }
        }
        onPackComplete();
    });
}

function onPackComplete() {
    if (currentScaleIndex < scales.length - 1) {
        currentScaleIndex++;
        currentScale = scales[currentScaleIndex];
        currentFileIndex = 0;
        blocks = [];
        packer = getNewPacker();
        prepareNextImg();
    } else {
        done();
    }
}

function getNewPacker() {
    return new MaxRectsPacker(4096, 4096, extraSpace, { smart: true, pot: pot, square: square });
}


function fitBlocks() {
    blocks.sort(function (a, b) { return Math.max(b.w, b.h) - Math.max(a.w, a.h); });
    blocks.sort(function (a, b) { Math.min(b.w, b.h) - Math.min(a.w, a.h); });
    blocks.sort(function (a, b) { return b.h - a.h; });
    blocks.sort(function (a, b) { return b.w - a.w; });
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
}

function clearTmp() {
    if (fs.existsSync(tmp)) {
        fs.readdirSync(tmp).forEach((file, index) => {
            fs.unlinkSync(tmp + "/" + file);
        });
        fs.rmdirSync(tmp);
    }
}

function orderedStringify(obj) {
    const allKeys = [];
    JSON.stringify(obj, (k, v) => {
        allKeys.push(k);
        return v;
    });
    return JSON.stringify(obj, allKeys.sort(naturalCompare));
}

function naturalCompare(a, b) {
    let ax = [],
        bx = [];

    a.replace(/(\d+)|(\D+)/g, function (_, $1, $2) {
        ax.push([$1 || Infinity, $2 || ""]);
    });
    b.replace(/(\d+)|(\D+)/g, function (_, $1, $2) {
        bx.push([$1 || Infinity, $2 || ""]);
    });

    while (ax.length && bx.length) {
        let an = ax.shift();
        let bn = bx.shift();
        let nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
        if (nn) return nn;
    }

    return ax.length - bx.length;
}
