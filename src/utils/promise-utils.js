const sequence = (arr) => arr.reduce((prev, job) => prev.then(job), Promise.resolve());
const parallel = (arr) => Promise.all(arr.map(job => job()));

module.exports = {
    sequence,
    parallel
};
