function isOlderVersion(current, minimum) {
  const cur = current.split('.').map(Number);
  const min = minimum.split('.').map(Number);

  for (let i = 0; i < Math.max(cur.length, min.length); i++) {
    const a = cur[i] || 0;
    const b = min[i] || 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}

module.exports = { isOlderVersion };
