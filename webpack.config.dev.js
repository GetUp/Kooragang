var path = require("path");
var webpack = require("webpack");

module.exports = {
  devtool: "eval",
  entry: [
    "webpack-hot-middleware/client?reload=true",
    "./campaigns/app"
  ],
  output: {
    path: path.join(__dirname, "build"),
    filename: "bundle.js",
    publicPath: "/static/"
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin()
  ],
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loader: "babel-loader",
        include: [
          path.join(__dirname, "src"),
          path.join(__dirname, "campaigns"),
          path.join(__dirname, "node_modules", "codemirror", "mode", "javascript"),
        ]
      },
      {
        test: /\.css$/,
        loader: "style!css",
        include: [
          path.join(__dirname, "css"),
          path.join(__dirname, "campaigns"),
          path.join(__dirname, "node_modules"),
        ],
      }
    ]
  }
};
