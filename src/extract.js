"use strict";

var fs = require("fs");
var exec = require("child_process").exec;
var ext = "";
var src = "";
var tmp = "tmp";
var done = null;
var list = null;
var frames = null;
var extracted = {};
var saveDublicates = false;
var dublicates = {};

module.exports = function (atlasId, cb) {
	src = atlasId;
	done = cb;
	list = [];
	extracted = {};
	dublicates = {};
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
		var atlas = JSON.parse(data);
		frames = atlas.frames;
		if(Array.isArray(atlas.frames)){
			frames = {};
			for(var i = 0; i<atlas.frames.length; i++){
				frames[atlas.frames[i].filename] = atlas.frames[i];
			}
		}
		for (var id in frames) {
			list.push(id);
		}
		extractNext();
	});
};

function extractNext() {
	if(list.length === 0){
		clearTmp();
		if(saveDublicates){
			fs.writeFile(src + "/frames.json", JSON.stringify(dublicates), saveConfig);
		}else{
			saveConfig();
		}
		return;
	}

	var fileId = list.shift();
	var outputName = fileId.split("/").join("_");
	outputName = outputName.split(".")[0] + ".png";

	var frame = frames[fileId].frame;
	var spriteSource = frames[fileId].spriteSourceSize || frame;
	var source = frames[fileId].sourceSize || frame;
	var frameId = [frame.x, frame.y, frame.w, frame.h].join("_");
	if(!extracted[frameId]){
		extracted[frameId] = {id:outputName, x:spriteSource.x, y:spriteSource.y};

        console.log("Extract", "\x1b[33m", src + "/" + outputName,"\x1b[0m");

		exec("convert -size " + frame.w + "x" + frame.h + " xc:transparent " + src + ext + " -geometry -" + frame.x + "-" + frame.y + " -composite  -strip " + tmp + "/" + outputName, (err, stdout, stderr) => {
			exec("convert -size " + source.w + "x" + source.h + " xc:transparent " + tmp + "/" + outputName + " -geometry +" + spriteSource.x + "+" + spriteSource.y + " -composite  -strip " + src + "/" + outputName, (err, stdout, stderr) => {
				extractNext();
			});
		});
	}else{
		saveDublicates = true;
		dublicates[outputName] = {
			id:extracted[frameId].id, 
			offsetX:spriteSource.x - extracted[frameId].x,
			offsetY:spriteSource.y - extracted[frameId].y
		};
		extractNext();
	}
}

function saveConfig(){
	if(ext === ".jpg" || ext === ".jpeg"){
		fs.writeFile(src + "/config.json", JSON.stringify({jpg:true, extraSpace:0}), done);
	}else{
		done();
	}
}

function clearTmp() {
	if (fs.existsSync(tmp)) {
		fs.readdirSync(tmp).forEach((file, index) => {
			fs.unlinkSync(tmp + "/" + file);
		});
		fs.rmdirSync(tmp);
	}
}