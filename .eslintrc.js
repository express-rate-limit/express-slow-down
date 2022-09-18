module.exports = {
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  env: {
    node: true,
    es2017: true,
  },
  overrides: [
    {
      files: ["*-test.js"],
      env: {
        mocha: true,
      },
    },
  ],
};
