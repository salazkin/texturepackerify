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
  await texturepackerify.pack({ inputDir: "./atlases" });
};
packAtlases();
```

### Step 3: Run the Script

Run the script to pack your images into atlases:

```sh
$ node pack.js
```

## Pack Config

The `pack` function accepts a `config` object with the following parameters:

### Pack Configuration Parameters

| Parameter             | Type                            | Default                           | Description                                               |
| --------------------- | ------------------------------- | --------------------------------- | --------------------------------------------------------- |
| `inputDir`            | `string`                        | `"./"`                            | The directory containing input atlas folders.             |
| `outputDir`           | `string`                        | Same as `inputDir`                | The directory for the generated output.                   |
| `hashPath`            | `string`                        | `"./.texturepackerify/hash.json"` | The path to the hash file for caching.                    |
| `force`               | `boolean`                       | `false`                           | Determines whether to force a rebuild of the atlases.     |
| `scales`              | `number[]`                      | `[1]`                             | An array of scale factors for generating mipmaps.         |
| `appendFileHash`      | `boolean`                       | `false`                           | Adds a file hash to output file names.                    |
| `appendTextureFormat` | `boolean`                       | `false`                           | Adds a texture format to output atlas names.              |
| `textureFormat`       | `"png"\|"jpeg"\|"webp"\|"avif"` | `"png"`                           | Specifies the texture output format.                      |
| `enableLogs`          | `boolean`                       | `true`                            | Enables or disables console logs.                         |
| `onProgress`          | `Function`                      | _(none)_                          | Callback function for tracking progress.                  |
| `defaultAtlasConfig`  | `Object`                        | `{}`                              | Customizes default atlas settings.                        |
| `formatConfig`        | `Object`                        | `{}`                              | Allows customization of texture format-specific settings. |

---

### `defaultAtlasConfig` Parameters

| Parameter          | Type                 | Default | Description                                              |
| ------------------ | -------------------- | ------- | -------------------------------------------------------- |
| `extraSpace`       | `number`             | `2`     | Space (in pixels) between texture frames.                |
| `border`           | `number`             | `0`     | Border (in pixels) around the atlas texture.             |
| `jpeg`             | `boolean`            | `false` | Force to use `jpeg` instead of `png` for texture format. |
| `removeAlpha`      | `boolean`            | `false` | Remove alpha chanel.                                     |
| `extrude`          | `boolean` or `array` | `false` | Expand image borders by one pixel in all directions.     |
| `pot`              | `boolean`            | `true`  | Force atlas size to be a power of two (e.g., 256x256).   |
| `square`           | `boolean`            | `false` | Force atlas size to be square.                           |
| `animations`       | `boolean`            | `false` | Enable animation parsing.                                |
| `alphaThreshold`   | `number`             | `1`     | Alpha threshold for trimming transparent areas.          |
| `spriteExtensions` | `boolean`            | `true`  | Append extensions (e.g., `.png`) to sprite frame names.  |
| `allowRotation`    | `boolean`            | `true`  | Allows sprite frame rotation.                            |
| `allowTrim`        | `boolean`            | `true`  | Enables the trimming of transparent pixels.              |
| `maxWidth`         | `number`             | `4096`  | Maximum texture width (in pixels).                       |
| `maxHeight`        | `number`             | `4096`  | Maximum texture height (in pixels).                      |

---

### `formatConfig` Options

| Format | Parameter      | Type     | Default | Description                                              |
| ------ | -------------- | -------- | ------- | -------------------------------------------------------- |
| `jpeg` | `quality`      | `number` | `80`    | Specifies compression quality (1-100).                   |
| `webp` | `quality`      | `number` | `80`    | Specifies compression quality (1-100).                   |
|        | `alphaQuality` | `number` | `80`    | Specifies compression quality for alpha channel (0–100). |
| `avif` | `quality`      | `number` | `50`    | Specifies compression quality (1–100).                   |

**Example `formatConfig`:**

## Quick Tips

- The `hash.json` file can be used to generate versioned atlases. Simply create a hash of this file and append it to the asset URL to prevent browser caching. Example URL: `my_atlas.png?v=kg5n2v3k8l`.
  Alternatively, you can set `appendFileHash : true` and get files names with hash, such as: `my_atlas.aht7k3bo1m5b2v6p9k1q.png`.

- To customize individual atlases, place a `config.json` file in the specific atlas folder. This configuration file will override the `defaultAtlasConfig`. This is useful for tasks like packing only certain atlases as `jpeg` files or adding a `border` to prevent texture glitches.

- To disable console logs, set `enableLogs: false`. You can also use the `onProgress` callback to customize your progress logs.

### Advanced Example

```javascript
const texturepackerify = require("texturepackerify");
const packAtlases = async () => {
  await texturepackerify.pack({
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
      webp: { quality: 80 },
    },
  });
};
packAtlases();
```
