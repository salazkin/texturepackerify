"use strict";

var fs = require("fs");
var pack = require('./src/pack');
var extract = require('./src/extract');
var hashUtil = require('./src/hashUtil');

var oldHash = {};
var newHash = null;

var force = false;
var hashUrl = "";
var assetsUrl = "";

function extractAtlases(config = {}, cb) {
	assetsUrl = config.url || "./";
	hashUrl = config.hashUrl || assetsUrl;
	if (!fs.existsSync(assetsUrl)) {
		trace("", `No dir ${assetsUrl}`, "\x1b[31m");
		return;
	}
	
	var extractList = [];
	var files = fs.readdirSync(assetsUrl);
	var skipList = [];
	files.forEach((file) => {
		if (fs.lstatSync(assetsUrl + file).isDirectory()) {
			skipList.push(file);
		} else {
			var match = file.indexOf(".json");
			if (match > -1) {
				extractList.push(file.substring(0, match));
			}
		}
	});

	extractList = extractList.filter((id) => skipList.indexOf(id) == -1);

	var next = function () {
		if (extractList.length) {
			extract(assetsUrl + extractList.shift(), next);
		} else {
			if (cb) {
				cb();
			}
		}
	};
	next();
}

function packAtlases(config = {}, cb) {
	assetsUrl = config.url || "./";
	hashUrl = config.hashUrl || assetsUrl;
	force = config.force || false;

	if (!fs.existsSync(assetsUrl)) {
		trace("", `No dir ${assetsUrl}`, "\x1b[31m");
		return;
	}

	var packList = [];
	var files = fs.readdirSync(assetsUrl);
	files.forEach((file) => {
		if (fs.lstatSync(assetsUrl + file).isDirectory()) {
			packList.push(file);
		}
	});

	var next = function () {
		if (!newHash) {
			getHash(next);
		} else if (packList.length) {
			buildAtlas(assetsUrl + packList.shift(), next);
		} else {
			hashUtil.saveHash(hashUrl, oldHash, () => {
				if (cb) {
					cb();
				}
			});
		}
	};
	next();
};

function getHash(next) {
	hashUtil.getHash(getFiles(), (hash) => {
		newHash = hash;
		hashUtil.loadHash(hashUrl, (hash) => {
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

		if (force) {
			skip = false;
		}

		if (!fs.existsSync(dir + ".json")) {
			skip = false;
		}
	}

	for (var hashId in oldHash) {
		if (hashId.indexOf(dir) > -1 && newHash[hashId] === undefined) {
			oldHash[hashId] = undefined;
			skip = false;
		}
	}

	if (!skip) {
		trace("Pack", dir + ".json", "\x1b[32m");
		pack(dir, newHash, () => {
			hashUtil.saveHash(hashUrl, oldHash, next);
		});
	} else {
		next();
	}
}

function getFiles() {
	var files = fs.readdirSync(assetsUrl);
	var list = [];
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		if (fs.lstatSync(assetsUrl + file).isDirectory()) {
			list = list.concat(fs.readdirSync(assetsUrl + file).map((id) => assetsUrl + file + "/" + id));
			list = list.filter((id) => id.indexOf(".png") !== -1 || id.indexOf(".json") !== -1);
		}
	}
	return list;
}

function trace(prefix, str, color) {
	console.log(`${prefix ? prefix + " ":""}${color || ""}${str}\x1b[0m`);
}

module.exports = {
	pack: packAtlases,
	extract: extractAtlases
}