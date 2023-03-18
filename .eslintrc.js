module.exports = {
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  env: {
    node: true,
    es2020: true,
  },
  overrides: [
    {
      files: ["test/**/*.js"],
      env: {
        jest: true,
      },
    },
  ],
};
