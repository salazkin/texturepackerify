# TexturePackerify
command-line texture packer and extractor.

### Installation

Requires [Node.js](https://nodejs.org/) and [ImageMagick](https://www.imagemagick.org/).

Navigate to your project folder and run:
```sh
$ npm install texturepackerify
```

### Example
Put images inside `./test/atlases/your_atlas_name/`
Create `index.js`:

```javascript
let texturepackerify = require("texturepackerify");
texturepackerify.pack({url:"./test/"}, ()=>{
	console.log("done!");
});
```
Run:
```sh
$ node index.js
```

### Config
By default TexturePackerify will not rebuild packed atlases, use `force:true` to rebuild all.
```javascript
texturepackerify.pack({url:"./test/", force:true});
```

### Extract
TexturePackerify will extract atlases if there is no source folders;
```javascript
texturepackerify.extract({url:"./test/"}, ()=>{console.log("done!")});
```