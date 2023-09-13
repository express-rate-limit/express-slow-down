const EventEmitter = require("events");

function makeReqPassValidation(req) {
  req.ip = "1.2.3.4";
  req.app = {
    get: () => false,
  };
  req.headers = [];
}

// these helpers expect timers to be mocked and setTimeout to be spied on

async function expectNoDelay(
  instance,
  req = new EventEmitter(),
  res = new EventEmitter()
) {
  const next = jest.fn();
  makeReqPassValidation(req);
  await instance(req, res, next);
  expect(setTimeout).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
}

async function expectDelay(
  instance,
  expectedDelay,
  req = new EventEmitter(),
  res = new EventEmitter()
) {
  const next = jest.fn();
  makeReqPassValidation(req);

  // set the timeout
  await instance(req, res, next);
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
  expectNoDelayPromise: expectNoDelay,
  expectDelay,
};
