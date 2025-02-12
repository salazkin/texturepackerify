#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { pack } = require('../src/texturepackerify');

const cwd = process.cwd();

(async function () {
    let config = {};

    const packageJson = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    const isModule = packageJson.type === 'module';

    try {
        const configFilePath = path.join(cwd, `.texturepackerify.${isModule ? "cjs" : "js"}`);
        config = require(configFilePath);
    } catch (error) {

    }
    await pack(config);
})();