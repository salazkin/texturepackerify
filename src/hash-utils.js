"use strict";

const fs = require("fs");
const md5File = require('md5-file');


function saveDirHash(gameId, dir, cb) {
    let assetsUrl = gameId + "/assets/";
    let src = assetsUrl + dir + "/";

    let list = [];
    const files = fs.readdirSync(src);

    files.forEach(file => {
        if (file.indexOf("DS_Store" === -1)) {
            list.push(src + file);
        }
    });

    let newHash = null;
    let oldHash = null;
    getHash(list, (hash) => {
        newHash = hash;
        loadHash(assetsUrl, (hash) => {
            oldHash = hash;
            for (let oldHashId in oldHash) {
                if (oldHashId.indexOf(src) > -1 && newHash[oldHashId] === undefined) {
                    oldHash[oldHashId] = undefined;
                }
            }
            for (let newHashId in newHash) {
                oldHash[newHashId] = newHash[newHashId];
            }
            saveHash(assetsUrl, oldHash, cb);
        });
    });
};


function loadHash(assetsUrl, cb) {
    let hashData = {};
    if (fs.existsSync(assetsUrl + "hash.json")) {
        fs.readFile(assetsUrl + "hash.json", "utf-8", function (err, data) {
            hashData = JSON.parse(data);
            cb(hashData);
        });
    } else {
        cb(hashData);
    }
};

function getHash(list, cb) {
    let files = JSON.parse(JSON.stringify(list));
    let hashData = {};
    let next = function () {
        if (files.length) {
            let id = files.shift();
            md5File(id, (err, hash) => {
                hashData[id] = hash;
                next();
            });
        } else {
            cb(hashData);
        }
    };
    next();
};

function saveHash(assetsUrl, hash, cb) {
    fs.writeFile(assetsUrl + "hash.json", JSON.stringify(hash, Object.keys(hash).sort(naturalCompare)), () => {
        md5File(assetsUrl + "hash.json", (err, hash) => {
            cb();
        });
    });
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

module.exports = {
    saveHash: saveHash,
    loadHash: loadHash,
    getHash: getHash,
    saveDirHash: saveDirHash
};
