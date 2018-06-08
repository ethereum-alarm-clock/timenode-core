const assert = (cond) => {
    if (!cond) throw new Error(cond + ' fails');
}

module.exports = {
    assert,
}