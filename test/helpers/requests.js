const EventEmitter = require("events");

// these helpers expect timers to be mocked and setTimeout to be spied on

function expectNoDelay(
  instance,
  req = new EventEmitter(),
  res = new EventEmitter()
) {
  const next = jest.fn();
  instance(req, res, next);
  expect(setTimeout).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
}

function expectDelay(
  instance,
  expectedDelay,
  req = new EventEmitter(),
  res = new EventEmitter()
) {
  const next = jest.fn();

  // set the timeout
  instance(req, res, next);
  expect(setTimeout).toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();

  // wait for it...
  jest.advanceTimersByTime(expectedDelay - 1);
  expect(next).not.toHaveBeenCalled();

  // now!
  jest.advanceTimersByTime(1);
  expect(next).toHaveBeenCalled();
}

module.exports = {
  expectNoDelay,
  expectDelay,
};
