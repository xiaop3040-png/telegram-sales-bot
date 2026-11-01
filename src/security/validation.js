function integer(value, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
    return value;
}
function text(value, name, max = 200) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid ${name}`);
    return value;
}
function quantity(value) { return integer(value,'quantity',1,999); }
module.exports = { integer, text, quantity };
