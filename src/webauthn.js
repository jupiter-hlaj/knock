class KnockError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.name = 'KnockError';
  }
}

module.exports = { KnockError };
// Full implementation in Step 2
