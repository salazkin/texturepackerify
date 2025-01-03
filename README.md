## TexturePackerify

TexturePackerify is a free, lightweight alternative to TexturePacker, built for seamless integration into your game asset build pipeline.

## Setup

Install the package:

```sh
$ npm install texturepackerify
```

## Build Atlases

### Step 1: Organize Images

Place your images into folders. Each folder will be packed into its own atlas. For example:

```
atlases/
├── atlas1/
│   ├── img0.png
│   ├── img1.png
│   ├── img2.png
├── atlas2/
│   ├── img12.png
│   ├── img13.png
│   ├── img14.png
```

### Step 2: Pack Atlases

#### Using the CLI:

Create a `.texturepackerify.js` file:

```javascript
module.exports = {
  inputDir: "./atlases",
  outputDir: "./output",
};
```

Add to `package.json`:

```json
"scripts": {
  "pack": "texturepackerify"
}
```

Run:

```sh
npm run pack
```

#### Using a Custom Script:

Create `pack.js`:

```javascript
const texturepackerify = require("texturepackerify");
const packAtlases = async () => {
  await texturepackerify.pack({
    inputDir: "./atlases",
    outputDir: "./output",
  });
};
packAtlases();
```

Run:

```sh
node pack.js
```

## Pack Config

The `pack` function accepts a `config` object with the following parameters:

### Pack Configuration Parameters

- **`inputDir`**: `string`. The directory containing input atlas folders. Default: `"./"`.
- **`outputDir`**: `string`. The directory for the generated output. Default: Same as `inputDir`.
- **`hashPath`**: `string`. The path to the hash file for caching. Default: `"./.texturepackerify/hash.json"`.
- **`force`**: `boolean`. Determines whether to force a rebuild of the atlases. Default: `false`.
- **`scales`**: `number[]`. An array of scale factors for generating mipmaps. Default: `[1]`.
- **`appendFileHash`**: `boolean`. Adds a file hash to output file names. Default: `false`.
- **`appendTextureFormat`**: `boolean`. Adds a texture format to output atlas names. Default: `false`.
- **`textureFormat`**: `"png" | "jpeg" | "webp" | "avif"`. Specifies the texture output format. Default: `"png"`.
- **`enableLogs`**: `boolean`. Enables or disables console logs. Default: `true`.
- **`onProgress`**: `Function`. Callback function for tracking progress. Default: _(none)_.
- **`defaultAtlasConfig`**: `Object`. Customizes default atlas settings. Default: `{}`.
- **`formatConfig`**: `Object`. Allows customization of texture format-specific settings. Default: `{}`.

### `defaultAtlasConfig` Parameters

- **`extraSpace`**: `number`. Space (in pixels) between texture frames. Default: `2`.
- **`border`**: `number`. Border (in pixels) around the atlas texture. Default: `0`.
- **`jpeg`**: `boolean`. Force to use `jpeg` instead of `png` for texture format. Default: `false`.
- **`removeAlpha`**: `boolean`. Remove alpha channel. Default: `false`.
- **`extrude`**: `boolean` or `array`. Expand image borders by one pixel in all directions. Default: `false`.
- **`pot`**: `boolean`. Force atlas size to be a power of two (e.g., 256x256). Default: `true`.
- **`square`**: `boolean`. Force atlas size to be square. Default: `false`.
- **`animations`**: `boolean`. Enable animation parsing. Default: `false`.
- **`alphaThreshold`**: `number`. Alpha threshold for trimming transparent areas. Default: `1`.
- **`spriteExtensions`**: `boolean`. Append extensions (e.g., `.png`) to sprite frame names. Default: `true`.
- **`allowRotation`**: `boolean`. Allows sprite frame rotation. Default: `true`.
- **`allowTrim`**: `boolean`. Enables the trimming of transparent pixels. Default: `true`.
- **`maxWidth`**: `number`. Maximum texture width (in pixels). Default: `4096`.
- **`maxHeight`**: `number`. Maximum texture height (in pixels). Default: `4096`.

### `formatConfig` Parameters

- **`jpeg`**:
  - **`quality`**: `number`. Specifies compression quality (1-100). Default: `80`.
- **`webp`**:
  - **`quality`**: `number`. Specifies compression quality (1-100). Default: `80`.
  - **`alphaQuality`**: `number`. Specifies compression quality for alpha channel (0-100). Default: `80`.
- **`avif`**:
  - **`quality`**: `number`. Specifies compression quality (1-100). Default: `50`.

## Quick Tips

- The `hash.json` file can be used to generate versioned atlases. Simply create a hash of this file and append it to the asset URL to prevent browser caching. Example URL: `my_atlas.png?v=kg5n2v3k8l`.
  Alternatively, you can set `appendFileHash : true` and get files names with hash, such as: `my_atlas-1vIVHTXW75Ce7I8x322Ofw.png`.

- To customize individual atlases, place a `config.json` file in the specific atlas folder. This configuration file will override the `defaultAtlasConfig`. This is useful for tasks like packing only certain atlases as `jpeg` files or adding a `border` to prevent texture glitches.

- To disable console logs, set `enableLogs: false`. You can also use the `onProgress` callback to customize your progress logs.

### Advanced Config Example

```javascript
module.exports = {
  inputDir: "./atlases",
  outputDir: "./public/assets",
  textureFormat: "webp",
  scales: [1, 0.5],
  defaultAtlasConfig: {
    pot: false,
    animations: true,
    border: 2,
  },
  formatConfig: {
    webp: { quality: 60 },
  },
};
```
