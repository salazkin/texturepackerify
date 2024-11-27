## TexturePackerify
TexturePackerify is a free, lightweight alternative to TexturePacker, built for seamless integration into your game asset build pipeline.

## Setup
Install the package via npm:
```sh
$ npm install texturepackerify
```

## Build Atlases

### Step 1: Organize Your Images
Place your images into folders. Each folder will be packed into its own atlas. For example:

```
atlases/
├── atlas1/
│   ├── img0.png
│   ├── img1.png
│   ├── ...
├── atlas2/
│   ├── img12.png
│   ├── img13.png
│   ├── ...
```

### Step 2: Create the Packing Script
Write a `pack.js` file to configure and run the packing process:

```javascript
const texturepackerify = require("texturepackerify");
const packAtlases = async () => {
  await texturepackerify.pack({
    inputDir: "./atlases",
    defaultAtlasConfig: { // Override default settings (e.g., extraSpace, jpg, pot).
      pot: false
    }
  });
}
packAtlases();
```

### Step 3: Run the Script
Run the script to pack your images into atlases:

```sh
$ node pack.js
```

## Pack Config
The `pack` function accepts a `config` object with the following parameters:

### Configuration Parameters (Compact)

- **`inputDir`** (`string`): Directory containing input atlas folders. Default: `"./"`.
- **`outputDir`** (`string`): Directory for the generated output. Default: Same as `inputDir`.
- **`hashPath`** (`string`): Path to the hash file for caching. Default: `"./.texturepackerify/hash.json"`.
- **`force`** (`boolean`): Specifies whether to force a rebuild of the atlases. Default: `false`.
- **`scales`** (`number[]`): An array of scale factors for generating mipmaps. Default: `[1]`.
- **`enableLogs`** (`boolean`): Enables or disables console logs. Default: `true`.
- **`onProgress`** (`Function`): Callback for progress updates. Default: *(none)*.
- **`defaultAtlasConfig`** (`Object`): Customizes default atlas settings. Default: `{}`.

## Atlas Config

You can customize atlas generation by using a `config.json` file. This file can be:

1. Placed inside each atlas folder to define **individual configurations** for that specific atlas.
2. Defined in the `pack.js` configuration (`defaultAtlasConfig`) to **override default properties** globally for all atlases.

Below are the available parameters:

### Configuration Parameters (Compact)

- **`extraSpace`** (`number`): Space (in pixels) between texture frames. Default: `2`.
- **`border`** (`number`): Border (in pixels) around the atlas texture. Default: `0`.
- **`jpg`** (`boolean`): Output the atlas as a JPEG file. Default: `false`.
- **`extrude`** (`boolean` or `array`): Expand image borders by one pixel in all directions. Accepts `true`, `false`, or an array of IDs. Default: `false`.
- **`pot`** (`boolean`): Force atlas size to be a power of two (e.g., 256x256). Default: `true`.
- **`square`** (`boolean`): Force atlas size to be square. Default: `false`.
- **`animations`** (`boolean`): Enable animation parsing. Default: `false`.
- **`alphaThreshold`** (`number`): Alpha threshold for trimming transparent areas. Default: `1`.
- **`spriteExtensions`** (`boolean`): Append extensions (e.g., `.png`) to sprite frame names. Default: `true`.
- **`allowRotation`** (`boolean`): Allows sprite frame rotation. Default: `true`.
- **`allowTrim`** (`boolean`): Enables the trimming of transparent pixels: `true`.
- **`maxWidth`** (`number`): Maximum texture width (in pixels). Default: `4096`.
- **`maxHeight`** (`number`): Maximum texture height (in pixels). Default: `4096`.

### Example `config.json` for Individual Atlases
Place a `config.json` file in the desired atlas folder (e.g., `atlases/atlas1/config.json`):

```json
{
  "extraSpace": 4,
  "border": 1,
  "jpg": true,
  "pot": false
}
```