#!/usr/bin/env node

const path = require('path');
const { pack } = require('../index');

const cwd = process.cwd();

(async function () {
    let config = {};
    try {
        const configFilePath = path.join(cwd, ".texturepackerify.js");
        config = require(configFilePath);
    } catch (error) {

    }
    await pack(config);
})();