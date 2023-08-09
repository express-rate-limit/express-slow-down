const EventEmitter = require("events");
const slowDown = require("../lib/express-slow-down");

describe("Connection closed during delay tests", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, "setTimeout");
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should not excute slow down timer in case of req closed", async () => {
    const req = new EventEmitter(),
      res = new EventEmitter();
    // gotta do a bunch of sillyness to convinve it the request isn't finished at the start
    req.socket = new EventEmitter();
    req.socket.readable = true;
    req.complete = false;
    req.readable = true;
    res.finished = false;
    const instance = slowDown({
      skipFailedRequests: true,
      delayAfter: 0,
      delayMs: 1000,
    });
    const next = jest.fn();

    instance(req, res, next);

    expect(next).not.toHaveBeenCalled();

    req.socket.emit("close"); // on-finish ignores the close event on the req/res, and only listens for it on the socket (?)
    req.emit("close");
    res.emit("close");
    //req.emit('end');

    jest.advanceTimersByTime(1001);

    expect(next).not.toHaveBeenCalled();
  });
});
