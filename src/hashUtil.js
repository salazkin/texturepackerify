"use strict";

var fs = require("fs");
var md5File = require('md5-file');


function saveDirHash(gameId, dir, cb) {
    var assetsUrl = gameId + "/assets/";
    var src = assetsUrl + dir + "/";

    var list = [];
    var files = fs.readdirSync(src);
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.indexOf("DS_Store" === -1)) {
            list.push(src + file);
        }
    }
    var newHash = null;
    var oldHash = null;
    getHash(list, (hash) => {
        newHash = hash;
        loadHash(assetsUrl, (hash) => {
            oldHash = hash;
            for (var oldHashId in oldHash) {
                if (oldHashId.indexOf(src) > -1 && newHash[oldHashId] === undefined) {
                    oldHash[oldHashId] = undefined;
                }
            }
            for (var newHashId in newHash) {
                oldHash[newHashId] = newHash[newHashId];
            }
            saveHash(assetsUrl, oldHash, cb);
        })
    });
};


function loadHash(assetsUrl, cb) {
    var hashData = {};
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
    var files = JSON.parse(JSON.stringify(list));
    var hashData = {};
    var next = function () {
        if (files.length) {
            var id = files.shift();
            md5File(id, (err, hash) => {
                hashData[id] = hash;
                next();
            })
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
    var ax = [],
        bx = [];

    a.replace(/(\d+)|(\D+)/g, function (_, $1, $2) {
        ax.push([$1 || Infinity, $2 || ""]);
    });
    b.replace(/(\d+)|(\D+)/g, function (_, $1, $2) {
        bx.push([$1 || Infinity, $2 || ""]);
    });

    while (ax.length && bx.length) {
        var an = ax.shift();
        var bn = bx.shift();
        var nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
        if (nn) return nn;
    }

    return ax.length - bx.length;
}

function hashCode(s) {
    var h = 0,
        l = s.length,
        i = 0;
    if (l > 0) {
        while (i < l) {
            h = (h << 5) - h + s.charCodeAt(i++) | 0;
        }
    }
    return h;
}

module.exports = {
    saveHash: saveHash,
    loadHash: loadHash,
    getHash: getHash,
    saveDirHash: saveDirHash
}