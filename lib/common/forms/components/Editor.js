"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _reactCodemirror = require("react-codemirror");

var _reactCodemirror2 = _interopRequireDefault(_reactCodemirror);

var _utils = require("../utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var cmOptions = {
  theme: "default",
  height: "auto",
  viewportMargin: Infinity,
  mode: {
    name: "javascript",
    json: true,
    statementIndent: 2
  },
  lineNumbers: true,
  lineWrapping: true,
  indentWithTabs: false,
  tabSize: 2
};

var Editor = function (_Component) {
  _inherits(Editor, _Component);

  function Editor(props) {
    _classCallCheck(this, Editor);

    var _this = _possibleConstructorReturn(this, (Editor.__proto__ || Object.getPrototypeOf(Editor)).call(this, props));

    _this.onCodeChange = function (code) {
      _this.setState({ valid: true, code: code });
      setImmediate(function () {
        try {
          _this.props.onChange(fromJson(_this.state.code));
        } catch (err) {
          _this.setState({ valid: false, code: code });
        }
      });
    };

    _this.state = { valid: true, code: props.code };
    return _this;
  }

  _createClass(Editor, [{
    key: "componentWillReceiveProps",
    value: function componentWillReceiveProps(props) {
      this.setState({ valid: true, code: props.code });
    }
  }, {
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate(nextProps, nextState) {
      return (0, _utils.shouldRender)(this, nextProps, nextState);
    }
  }, {
    key: "render",
    value: function render() {
      var _props = this.props,
          title = _props.title,
          theme = _props.theme;

      var icon = this.state.valid ? "ok" : "remove";
      var cls = this.state.valid ? "valid" : "invalid";
      return _react2.default.createElement(
        "div",
        { className: "panel panel-default" },
        _react2.default.createElement(
          "div",
          { className: "panel-heading" },
          _react2.default.createElement("span", { className: cls + " glyphicon glyphicon-" + icon }),
          " " + title
        ),
        _react2.default.createElement(_reactCodemirror2.default, {
          value: this.state.code,
          onChange: this.onCodeChange,
          options: Object.assign({}, cmOptions, { theme: theme })
        })
      );
    }
  }]);

  return Editor;
}(_react.Component);

exports.default = Editor;