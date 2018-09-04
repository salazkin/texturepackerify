"use strict";

var fs = require("fs");
var exec = require("child_process").exec;
var tmpdir = require('os').tmpdir();
var MaxRectsPacker = require("maxrects-packer").MaxRectsPacker;
var packer = null;
var done = null;
var tmp = "";
var offset = 2;
var src = "";
var blocks = [];
var files = [];
var atlas = null;
var duplicates = {};
var hash = {};

var extraSpace = 0;
var jpg = false;
var pot = true;
var square = false;
var colorDepth = 8;
var extrude = false;
var extrudeList = [];

module.exports = function(srcStr, hashObj, cb) {
	hash = hashObj;
	tmp = tmpdir + "/lgs-tmp";
	src = srcStr;
	done = cb;
	blocks = [];
	duplicates = {};
	files = fs.readdirSync(src).filter((value) => value.indexOf(".png") > -1);

	if (!fs.existsSync(tmp)) {
		fs.mkdirSync(tmp);
	}

	readConfig();
};

function readConfig(){
	if (fs.existsSync(src + "/config.json")) {
		fs.readFile(src + "/config.json", "utf-8", function(err, data) {
			initPacker(JSON.parse(data));
		});
	} else {
		initPacker({});
	}
}

function initPacker(config){
	jpg = config.jpg || false;
	extraSpace = config.extraSpace || 2;
	pot = config.pot || true;
	square = config.square || false;
	colorDepth = config.colorDepth || 8;

	if(config.extrude && Array.isArray(config.extrude)){
		extrudeList = config.extrude;
		extrude = extrudeList.length > 0;
	}else{
		extrudeList = [];
		extrude = config.extrude || false;
	}
	
	packer = new MaxRectsPacker(4096, 4096, extraSpace, {smart:true, pot:pot, square:square});
	trimNext();
}

function trimNext() {
	if (files.length === 0) {
		buildAtlas();
		return;
	}

	var img = files.shift();
	exec("convert " + src + "/" + img + " -border " + offset + "x" + offset + " -trim -format \"%W %H %X %Y %w %h %#\" info:-", (err, stdout, stderr) => {
		var data = stdout.split(" ");
		var block = { id: img };

		var extrudeSpace = getExtrudeSpace(img) * 2;

		block.width = Number(data[0]) - offset * 2 + extraSpace + extrudeSpace;
		block.height = Number(data[1]) - offset * 2 + extraSpace + extrudeSpace;
		block.x = Number(data[2]) - offset;
		block.y = Number(data[3]) - offset;
		block.w = Number(data[4]) + extraSpace + extrudeSpace;
		block.h = Number(data[5]) + extraSpace + extrudeSpace;
		block.hash = data[6];
		block.trim = (block.width !== block.w || block.height !== block.h);
		blocks.push(block);
		var hashId = hash[src + "/" + img] + ".png";
		if (block.trim && !fs.existsSync(tmp + "/" + hashId)) {
			exec("convert -background none " + src + "/" + img + " -bordercolor none -border " + offset + "x" + offset + " -trim " + tmp + "/" + hashId, (err, stdout, stderr) => {
				trimNext();
			});
		} else {
			trimNext();
		}
	});
}

function getExtrudeSpace(img){
	let space = extrude ? 1 : 0;
	if(extrudeList.length > 0){
		space = (extrudeList.indexOf(img) > -1) ? 1 : 0;
	}
	return space;
}

function buildAtlas() {
	fitBlocks();

	atlas = {
		frames: {}
	}
	for (var i = 0; i < blocks.length; i++) {
		var block = blocks[i];
		var extrudeSpace = getExtrudeSpace(block.id);
		atlas.frames[block.id] = {
			frame: { 
				x: block.fit.x + extrudeSpace, 
				y: block.fit.y + extrudeSpace, 
				w: block.w - extraSpace - (extrudeSpace*2), 
				h: block.h - extraSpace - (extrudeSpace*2)
			},
			spriteSourceSize: { 
				x: block.x, 
				y: block.y, 
				w: block.w - extraSpace - (extrudeSpace*2), 
				h: block.h - extraSpace - (extrudeSpace*2)
			},
			sourceSize: { 
				w: block.width - extraSpace - (extrudeSpace*2), 
				h: block.height - extraSpace - (extrudeSpace*2)
			},
			trimmed: block.trim,
			dup:block.isDuplicate
		};
	}

	var atlasWidth = packer.bins[0].width;
	var atlasHeight = packer.bins[0].height;

	if(!pot){
		atlasWidth -= extraSpace;
		atlasHeight -= extraSpace;
	}
	
	var textureId = src.split("/").pop();
	var ext = jpg ? ".jpg" : ".png";
	atlas.meta = {
		app: "http://www.texturepacker.com",
		version: "1.0",
		image: textureId + ext,
		format: "RGBA8888",
		size: { w: atlasWidth, h: atlasHeight },
		scale: 1
	};

	if (fs.existsSync(src + "/frames.json")) {
		fs.readFile(src + "/frames.json", "utf-8", function(err, data) {
			duplicates = JSON.parse(data);
			for (var duplicateId in duplicates) {
				var duplicateData = duplicates[duplicateId];
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
	var framesStr = orderedStringify(atlas.frames);
	if(framesStr.length > 2){
		framesStr = framesStr.substring(1, framesStr.length - 2);
		framesStr = framesStr.replace(/"frame"/g, "\n\t\t\"frame\"");
		framesStr = framesStr.replace(/"spriteSourceSize"/g, "\n\t\t\"spriteSourceSize\"");
		framesStr = framesStr.replace(/"sourceSize"/g, "\n\t\t\"sourceSize\"");
		framesStr = framesStr.replace(/"trimmed"/g, "\n\t\t\"trimmed\"");
		framesStr = framesStr.replace(/}},/g, "}\n\t},\n\t");
		framesStr = framesStr.replace(/true},/g, "true\n\t},\n\t");
		framesStr = framesStr.replace(/false},/g, "false\n\t},\n\t");
	}

	var metaStr = JSON.stringify(atlas.meta);
	metaStr = metaStr.substring(1, metaStr.length - 1);

	for (var metaId in atlas.meta) {
		metaStr = metaStr.replace(new RegExp("\"" + metaId + "\"", "g"), "\n\t\"" + metaId + "\"");
	}

	var atlasStr = "{\"frames\":{\n\t" + framesStr + "\n\t}\n},\n\"meta\":{" + metaStr + "\n}\n}";
	
	fs.writeFile(src + ".json", atlasStr, saveBlocksData);
}

function saveBlocksData() {
	var blocksStr = "";
	for (var id in atlas.frames) {
		if(duplicates[id] === undefined && !atlas.frames[id].dup){
			var frame = atlas.frames[id].frame;
			var img = atlas.frames[id].trimmed ? tmp + "/" + hash[src + "/" + id] + ".png" : src + "/" + id;
			if(getExtrudeSpace(id) > 0){
				blocksStr += addExtrudeData(img, frame);
			}
			blocksStr += " " + img + " -geometry +" + frame.x + "+" + frame.y + " -composite";
		}
	}
	fs.writeFile("blocks.txt", blocksStr, saveTexture);
}


function addExtrudeData(img, frame){
	var str = "";
	str += " " + img + " -geometry +" + (frame.x-1) + "+" + (frame.y-1) + " -composite";
	str += " " + img + " -geometry +" + (frame.x+1) + "+" + (frame.y-1) + " -composite";
	str += " " + img + " -geometry +" + (frame.x-1) + "+" + (frame.y+1) + " -composite";
	str += " " + img + " -geometry +" + (frame.x+1) + "+" + (frame.y+1) + " -composite";
	str += " " + img + " -geometry +" + (frame.x+1) + "+" + frame.y + " -composite";
	str += " " + img + " -geometry +" + (frame.x-1) + "+" + frame.y + " -composite";
	str += " " + img + " -geometry +" + frame.x + "+" + (frame.y-1) + " -composite";
	str += " " + img + " -geometry +" + frame.x + "+" + (frame.y+1) + " -composite";
	return str;
}

function saveTexture() {
	var ext = jpg ? ".jpg" : ".png";
	var cmd = [
		"convert",
		"-size",
		atlas.meta.size.w + "x" + atlas.meta.size.h,
		"xc:transparent",
		"@blocks.txt",
		"-depth "+colorDepth,
		src + ext
	];

	exec(cmd.join(" "), (err, stdout, stderr) => {
		if(stderr){
			console.log(stderr);
		}
		fs.unlinkSync("blocks.txt");
		if (fs.existsSync(tmp)) {
			var size = 0;
			fs.readdirSync(tmp).forEach((file, index) => {
				size += fs.statSync(tmp + "/" + file).size;
			});
			if(size / 1024 / 1024 > 100){
				clearTmp();
			}
		}
		done();
	});
}

function fitBlocks() {
	blocks.sort(function(a, b) { return Math.max(b.w, b.h) - Math.max(a.w, a.h); });
	blocks.sort(function(a, b) { Math.min(b.w, b.h) - Math.min(a.w, a.h); });
	blocks.sort(function(a, b) { return b.h - a.h; });
	blocks.sort(function(a, b) { return b.w - a.w; });
	let uniq = new Set();
	let blocksWithoutDups = blocks.filter(block=>{
		if(!uniq.has(block.hash)){
		uniq.add(block.hash);
		return block;
	}
}
)

	let fullNotation  = blocksWithoutDups.map(block=>{
		var newBlock = {};
		newBlock.width = block.w;
		newBlock.height = block.h;
		newBlock.data = block.id;
		return newBlock;
	});

	packer.addArray(fullNotation);

	blocksWithoutDups.forEach(e=>{
		var fitted = packer.bins[0].rects.find(packed=>packed.data == e.id);
		e.fit={x:fitted.x,y:fitted.y};
	});

	blocks.forEach(block=>{
		if(!block.fit){
			blocksWithoutDups.forEach(fitBlock=>{
				if(fitBlock.hash==block.hash){
					block.fit = fitBlock.fit;
					block.isDuplicate = true;
					return true;
				}
			})
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
	var ax = [],
		bx = [];

	a.replace(/(\d+)|(\D+)/g, function(_, $1, $2) {
		ax.push([$1 || Infinity, $2 || ""]);
	});
	b.replace(/(\d+)|(\D+)/g, function(_, $1, $2) {
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