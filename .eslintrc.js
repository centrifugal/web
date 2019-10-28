module.exports = {
    parser: "babel-eslint",
    parserOptions: {
        ecmaVersion: 6,
        sourceType: "module",
        ecmaFeatures: {
            jsx: true,
            modules: true,
            experimentalObjectRestSpread: true
        }
    },
    extends: [
        "plugin:react/recommended"
    ],
    plugins: ["react"],
    env: {
        es6: true,
        browser: true,
        node: true,
        jest: true
    },
    rules: {
        "react/jsx-filename-extension": [1, { extensions: [".js", ".jsx"] }]
    }
};