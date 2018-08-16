# TexturePackerify
command-line texture packer and extractor.

### Installation

Requires [Node.js](https://nodejs.org/) and [ImageMagick](https://www.imagemagick.org/).

create `index.js` inside your folder

```javascript
let texturepackerify = require("texturepackerify");
texturepackerify();
```
run
```sh
$ npm install texturepackerify
```

### Build
Put images inside `atlases/your_atlas_name`

run
```sh
$ node index.js
```

### Extract
You can put packed atlases inside `atlases/` folder and TexturePackerify will automatically extract images.