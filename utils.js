module.exports.sleep = (ms = 0) => {
  const timeout = process.env.NODE_ENV === "test" ? 0 : ms;
  return new Promise(r => setTimeout(r, timeout));
}

