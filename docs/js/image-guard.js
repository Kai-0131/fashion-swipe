// Stops the swipe stack from flipping forever when photos cannot load (offline, blocked images).
export function createImageGuard(limit = 5) {
  let errors = 0;
  return {
    get tripped() { return errors >= limit; },
    fail() { errors++; return errors >= limit; },
    ok() { errors = 0; },
    reset() { errors = 0; },
  };
}
