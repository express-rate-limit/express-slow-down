function InvalidStore() {}

function MockStore() {
  this.incr_was_called = false;
  this.resetKey_was_called = false;
  this.decrement_was_called = false;
  this.counter = 0;

  this.incr = (key, cb) => {
    this.counter++;
    this.incr_was_called = true;

    cb(null, this.counter);
  };

  this.decrement = () => {
    //console.log('decrementing')
    this.counter--;
    this.decrement_was_called = true;
  };

  this.resetKey = () => {
    this.resetKey_was_called = true;
    this.counter = 0;
  };
}

module.exports = {
  InvalidStore,
  MockStore,
};
