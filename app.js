const port = process.env.PORT || 8080;
const express = require('express');
const app = express();
const path = require("path");

if (process.env.NODE_ENV === 'development') {
  const webpack = require("webpack");
  const env = "dev";
  const webpackConfig = require("./webpack.config." + env);
  const compiler = webpack(webpackConfig);

  app.use(require("webpack-dev-middleware")(compiler, {
    publicPath: webpackConfig.output.publicPath,
    noInfo: true
  }));
  app.use(require("webpack-hot-middleware")(compiler));
  app.use(express.static(path.join(__dirname, '/public')));
  //app.use(require('body-parser'))
}

if (process.env.NODE_ENV === 'development' || process.env.IVR) {
  app.use(require('./ivr/common'));
  app.use(require('./ivr/passcode'));
  app.use(require('./ivr/team'));
  app.use(require('./ivr/log'));
  app.use(require('./ivr/caller'));
  app.use(require('./ivr/callee'));
  app.use(require('./ivr/redirect'));
}

if (process.env.NODE_ENV === 'development' || process.env.GUI) {
  app.use(require('./reports'));
  app.use(require('./campaigns'));
  app.use(require('./teams/team'));
}

if (process.env.NODE_ENV === 'development' || process.env.API) {
  app.use(require('./api/campaigns'));
}

app.listen(port, (err) => {
  if (err) { console.log(err); return; }
  console.log('App running on port', port)
});
