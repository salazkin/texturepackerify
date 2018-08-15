"use strict";

var fs = require("fs");
var pack = require('./src/pack');
var extract = require('./src/extract');
var hashUtil = require('./src/hashUtil');

var oldHash = {};
var newHash = null;

var assetsUrl = "";
var src = "";

module.exports = function(url) {
	assetsUrl = url ? url : "./";
	src = assetsUrl + "atlases/";

	if (!fs.existsSync(src)) {
        console.log("\x1b[31m", "No dir " + src, "\x1b[0m");
		return;
	}

	var packList = [];
	var extractList = [];
	var files = fs.readdirSync(src);
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		if (fs.lstatSync(src + file).isDirectory()) {
			packList.push(file);
		} else {
			var match = file.indexOf(".json");
			if (match > -1) {
				extractList.push(file.substring(0, match));
			}
		}
	}
	extractList = extractList.filter((id) => packList.indexOf(id) == -1);
	packList = packList.concat(extractList);
	var next = function () {
		if (extractList.length) {
			extract(src + extractList.shift(), next)
		} else if (!newHash) {
			getHash(next);
		} else if (packList.length) {
			buildAtlas(src + packList.shift(), next);
		} else {
			hashUtil.saveHash(assetsUrl, oldHash, ()=>{
                // done
            });
		}
	};
	next();
};

function getHash(next) {
	hashUtil.getHash(getFiles(), (hash) => {
		newHash = hash;
		hashUtil.loadHash(assetsUrl, (hash) => {
			oldHash = hash;
			next();
		})
	});
}

function buildAtlas(dir, next) {
	var files = fs.readdirSync(dir).filter((value) => value.indexOf(".png") > -1 || value.indexOf(".json") > -1);
	var skip = true;

	if (files.length > 0) {
		for (var i = 0; i < files.length; i++) {
			var fileId = dir + "/" + files[i];
			if (oldHash[fileId] === undefined || oldHash[fileId] !== newHash[fileId]) {
				skip = false;
				oldHash[fileId] = newHash[fileId];
			}
		}

		if (process.argv.indexOf("-f") !== -1) {
			skip = false;
		}

		if (!fs.existsSync(dir + ".json")) {
			skip = false;
		}
	}

	for (var hashId in oldHash) {
		if (hashId.indexOf(dir) > -1 && newHash[hashId] === undefined) {
			oldHash[hashId] = undefined;
		}
	}

	if (!skip) {
		pack(dir, newHash, () => {
			hashUtil.saveHash(assetsUrl, oldHash, next);
		});
	} else {
        //console.log("\x1b[2m", "Skip " + dir, "\x1b[0m");
		next();
	}
}

function getFiles() {
	var files = fs.readdirSync(src);
	var list = [];
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		if (fs.lstatSync(src + file).isDirectory()) {
			list = list.concat(fs.readdirSync(src + file).map((id) => src + file + "/" + id));
			list = list.filter((id) => id.indexOf(".png") !== -1 || id.indexOf(".json") !== -1);
		}
	}
	return list;
}