const sequence = (arr) => arr.reduce((prev, job) => prev.then(job), Promise.resolve());

module.exports = {
    sequence
};
