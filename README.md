# TexturePackerify
Command-line Texture Packer and Extractor.

## Setup
- Install [Node.js](https://nodejs.org/) 
- Install [ImageMagick](https://www.imagemagick.org/) (check "**Install legacy utilities**" during installation.)
- Navigate to your project root and run:
```sh
$ npm install texturepackerify
```

## Build Atlases
Place images inside folders. Each folder will be packed to atlas:
```
src
├── atlas1
│  ├── img0.png
│  ├── img1.png
│  ├── ...
├── atlas2
│  ├── img12.png
│  ├── img13.png
│  ├── ...
```

Create `pack.js`:
```javascript
const texturepackerify = require("texturepackerify");
const config = {
    url: "./src/", //path to atlases. Default: './'
    hashUrl: "./src/", //where to store 'hash.json'. Atlases path will be used as default
    scales: [1, 0.5] //output scales. Default: [1]
    force: false //force rebuild all atlases. By default packed atlases will be skipped
    defaultAtlasConfig: {
        //Override default atlas config: extraSpace, jpeg, extrude, pot, square, colorDepth, animations, spriteExtensions
    }
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
```
src
├──...
│  atlas1.png
│  atlas1.json
│  atlas2.png
│  atlas2.json
│  hash.json
│  ...
```

## Atlas Config
Each atlas can hold `config.json` with parameters:

- `"extraSpace"` - space between texture frames. Default - `2`
- `"border"` - texture border. Default - `0`
- `"jpeg"` - output to jpeg. Default - `false`
- `"extrude"` - add extra pixels in bounds. Default - `false`
- `"pot"` - atlas size fixed to power of two. Default - `true`
- `"square"` - atlas size fixed to square. Default - `false`
- `"colorDepth"` - color depth for texture. Default - `8`
- `"animations"` - parse animations. Default - `false`
- `"spriteExtensions"` - add extension to frame name. Default - `true`

## Example
Place `config.json` in `atlas` folder:
```
src
├── atlas1
│  ├── img0.png
│  ├── ...
│  ├── config.json
```

`config.json`:
```javascript
{
    "extraSpace": 0,
    "jpg": true,
    "extrude": true,
    "square": true,
    "colorDepth": 8
}
```

## Extract
TexturePackerify can extract atlases. Place `atlas.png` and `atlas.json` to `src` folder.
Create `extract.js`:
```javascript
const texturepackerify = require("texturepackerify");
texturepackerify.extract({url:"./src/"}, ()=>{console.log("done!")});
```
Run:
```sh
$ node extract.js
```
