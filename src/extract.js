"use strict";

const fs = require("fs");
const exec = require("child_process").exec;
const log = require('./utils/log');
const filesHelper = require('./utils/files-helper');

const tmp = filesHelper.getTempFolderPath();
let ext = "";
let src = "";
let done = null;
let list = null;
let frames = null;
let extracted = {};
let saveDuplicates = false;
let duplicates = {};

module.exports = (atlasId, cb) => {
    src = atlasId;
    done = cb;
    list = [];
    extracted = {};
    duplicates = {};
    if (!fs.existsSync(tmp)) {
        fs.mkdirSync(tmp);
    }
    if (!fs.existsSync(src)) {
        fs.mkdirSync(src);
    }

    if (fs.existsSync(src + ".png")) {
        ext = ".png";
    } else if (fs.existsSync(src + ".jpg")) {
        ext = ".jpg";
    } else if (fs.existsSync(src + ".jpeg")) {
        ext = ".jpeg";
    }

    fs.readFile(src + ".json", function (err, data) {
        let atlas = JSON.parse(data);
        frames = atlas.frames;
        if (Array.isArray(atlas.frames)) {
            frames = {};
            for (let i = 0; i < atlas.frames.length; i++) {
                frames[atlas.frames[i].filename] = atlas.frames[i];
            }
        }
        for (let id in frames) {
            list.push(id);
        }
        extractNext();
    });
};

const extractNext = () => {
    if (list.length === 0) {
        filesHelper.clearTempFolder();
        if (saveDuplicates) {
            fs.writeFile(src + "/frames.json", JSON.stringify(duplicates), saveConfig);
        } else {
            saveConfig();
        }
        return;
    }

    const fileId = list.shift();
    let outputName = fileId.split("/").join("_");
    outputName = outputName.split(".")[0] + ".png";

    const frame = frames[fileId].frame;
    const spriteSource = frames[fileId].spriteSourceSize || frame;
    const source = frames[fileId].sourceSize || frame;
    const frameId = [frame.x, frame.y, frame.w, frame.h].join("_");
    if (!extracted[frameId]) {
        extracted[frameId] = { id: outputName, x: spriteSource.x, y: spriteSource.y };
        log.trace("Extract", src + "/" + outputName, log.COLOR.YELLOW);

        exec("convert -size " + frame.w + "x" + frame.h + " xc:transparent " + src + ext + " -geometry -" + frame.x + "-" + frame.y + " -composite  -strip " + tmp + "/" + outputName, (err, stdout, stderr) => {
            if (err || stderr) {
                console.log(err, stderr);
            }
            exec("convert -size " + source.w + "x" + source.h + " xc:transparent " + tmp + "/" + outputName + " -geometry +" + spriteSource.x + "+" + spriteSource.y + " -composite  -strip " + src + "/" + outputName, (err, stdout, stderr) => {
                if (err || stderr) {
                    console.log(err, stderr);
                }
                extractNext();
            });
        });
    } else {
        saveDuplicates = true;
        duplicates[outputName] = {
            id: extracted[frameId].id,
            offsetX: spriteSource.x - extracted[frameId].x,
            offsetY: spriteSource.y - extracted[frameId].y
        };
        extractNext();
    }
};


const saveConfig = () => {
    if (ext === ".jpg" || ext === ".jpeg") {
        fs.writeFile(src + "/config.json", JSON.stringify({ jpg: true, extraSpace: 0 }), done);
    } else {
        done();
    }
};
