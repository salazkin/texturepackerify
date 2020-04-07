# TexturePackerify
Command-line Texture Packer and Extractor.

# Setup
- Install [Node.js](https://nodejs.org/) 
- Install [ImageMagick](https://www.imagemagick.org/) (check "**Install legacy utilities**" during instalation.)
- Navigate to your project root and run:
```sh
$ npm install texturepackerify
```

# Build Atlases
Place images inside folders. Each folder will be packed to atlas:
```sh
src
|- atlas1
|  |- img0.png
|  |- img1.png
|  |- ...
|- atlas2
|  |- img12.png
|  |- img13.png
|  |- ...
```

Create `pack.js`:
```javascript
let texturepackerify = require("texturepackerify");
let config = {
    url: "./src/", //Path to atlases. Default - './'
    hashUrl: "./src/", //Where to store 'hash.json'. Atlases path will be used as default
    force: false //Force rebuild all atlases. By default packed atlases will be skipped.
}
texturepackerify.pack(config, () => {
    console.log("done!");
});
```
Run:
```sh
$ node pack.js
```

Output:
```sh
src
|- ...
|  atlas1.png
|  atlas1.json
|  atlas2.png
|  atlas2.json
|  hash.json
|  ...
```

### Atlas Config
Each atlas can hold `config.json` with parameters:

- `"extraSpace"` - space between texture frames. Default - `2`
- `"jpeg"` - output to jpeg. Default - `false`
- `"extrude"` - add extra pixels in bounds. Default - `false`
- `"pot"` - atlas size fixed to power of two. Default - `true`
- `"square"` - atlas size fixed to squre. Default - `false`
- `"colorDepth"` - color depth for texture. Default - `8`

### Example
Place `config.json` in `atlas` folder:
```sh
src
|- atlas1
|  |- img0.png
|  |- ...
|  |- config.json
```
`config.json`:
```javascript
{
    "extraSpace":0,
	"jpg":true,
	"extrude":true,
	"square":true,
	"colorDepth": 8
}
```

### Extract
TexturePackerify can extract atlases. Place `atlas.png` and `atlas.json` to `src` folder:
Create `extract.js`:
```javascript
texturepackerify.extract({url:"./src/"}, ()=>{console.log("done!")});
```
Run:
```sh
$ node extract.js
```