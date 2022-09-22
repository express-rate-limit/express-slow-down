const express = require("express");
const request = require("supertest");
const bodyParser = require("body-parser");
const slowDown = require("../lib/express-slow-down");
const { MockStore } = require("./helpers/mock-store");

describe("realtime tests", () => {
  it("should handle a req being processed before express-slow-down (realtime) (#31 & #32)", (done) => {
    const app = express();

    // Note: in real-world usabe, bodyParser come *after* express-slow-down
    app.use(bodyParser.json({ limit: "50mb" }));

    app.use(
      slowDown({
        delayAfter: 0,
        delayMs: 100,
        store: new MockStore(),
      })
    );
    app.post("/upload", (req, res) => {
      if (req.body.test) {
        res.send("success!");
      } else {
        res.status(400).send("missing test key in body");
      }
    });

    request(app)
      .post("/upload")
      .send({ test: true })
      .expect(200)
      .expect(/success!/)
      .end(done);
  });
});
