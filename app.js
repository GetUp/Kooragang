const port = process.env.PORT || 8080;
const app = require('express')();

if (process.env.NODE_ENV === 'development' || process.env.IVR) {
  app.use(require('./ivr/common'));
  app.use(require('./ivr/passcode'));
  app.use(require('./ivr/team'));
  app.use(require('./ivr/log'));
  app.use(require('./ivr/caller'));
  app.use(require('./ivr/callee'));
  app.use(require('./ivr/redirect'));
}

if (process.env.NODE_ENV === 'development' || !process.env.IVR) {
  const webpack = require("webpack");
  const env = "dev";
  const webpackConfig = require("./webpack.config." + env);
  const compiler = webpack(webpackConfig);
  const bodyParser = require('body-parser');

  app.use(require("webpack-dev-middleware")(compiler, {
    publicPath: webpackConfig.output.publicPath,
    noInfo: true
  }));
  app.use(require("webpack-hot-middleware")(compiler));
  app.use(bodyParser.json())

  app.use(require('./reports'));
  app.use(require('./campaigns'));
  app.use(require('./teams/team'));
}

app.listen(port, (err) => {
  if (err) { console.log(err); return; }
  console.log('App running on port', port)
});
