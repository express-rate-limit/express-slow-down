const slowDown = require("../lib/express-slow-down");
const express = require("express");
const http = require("http");
const axios = require("axios");
const assert = require("assert");

const TEST_PORT = 3300;
const SERVER_WORKING_DELAY = 100;
const defaultConfig = {
  headers: true,
};

function assertHeaders(payload, limit, remaining) {
  assert(Number(payload.headers["x-slowdown-remaining"]) === remaining);
  assert(Number(payload.headers["x-slowdown-limit"]) === limit);
}

async function fetch() {
  const { data, status, headers } = await axios(
    `http://localhost:${TEST_PORT}`
  );
  return { data, status, headers };
}

function asyncServerClose(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
      } else resolve(true);
    });
  });
}

function buildTestServer(slowDownConfig) {
  const app = express();
  Object.assign(slowDownConfig, defaultConfig);
  app.use(slowDown(slowDownConfig));
  app.get("/", (req, res) => {
    setTimeout(() => {
      res.status(200);
      res.send({ sucess: true });
    }, SERVER_WORKING_DELAY);
  });
  return http.createServer(app).listen(TEST_PORT);
}

describe.only("Integration With Express Server", () => {
  describe("configuration tests", () => {
    const config = {
      windowMs: 500,
      delayAfter: 3,
      delayMs: 100,
    };

    it("sanity test", async () => {
      const server = buildTestServer(config);
      const req1 = await fetch();
      const req2 = await fetch();
      const req3 = await fetch();
      assertHeaders(req1, 3, 2);
      assertHeaders(req2, 3, 1);
      assertHeaders(req3, 3, 0);
      const closed = await asyncServerClose(server);
      assert(closed);
    });
  });
});
