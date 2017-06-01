"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var GeoPosition = function (_Component) {
  _inherits(GeoPosition, _Component);

  function GeoPosition(props) {
    _classCallCheck(this, GeoPosition);

    var _this = _possibleConstructorReturn(this, (GeoPosition.__proto__ || Object.getPrototypeOf(GeoPosition)).call(this, props));

    _this.state = _extends({}, props.formData);
    return _this;
  }

  _createClass(GeoPosition, [{
    key: "onChange",
    value: function onChange(name) {
      var _this2 = this;

      return function (event) {
        _this2.setState(_defineProperty({}, name, parseFloat(event.target.value)));
        setImmediate(function () {
          return _this2.props.onChange(_this2.state);
        });
      };
    }
  }, {
    key: "render",
    value: function render() {
      var _state = this.state,
          lat = _state.lat,
          lon = _state.lon;

      return _react2.default.createElement(
        "div",
        { className: "geo" },
        _react2.default.createElement(
          "h3",
          null,
          "Hey, I'm a custom component"
        ),
        _react2.default.createElement(
          "p",
          null,
          "I'm registered as ",
          _react2.default.createElement(
            "code",
            null,
            "geo"
          ),
          " and referenced in",
          _react2.default.createElement(
            "code",
            null,
            "uiSchema"
          ),
          " as the ",
          _react2.default.createElement(
            "code",
            null,
            "ui:field"
          ),
          " to use for this schema."
        ),
        _react2.default.createElement(
          "div",
          { className: "row" },
          _react2.default.createElement(
            "div",
            { className: "col-sm-6" },
            _react2.default.createElement(
              "label",
              null,
              "Latitude"
            ),
            _react2.default.createElement("input", {
              className: "form-control",
              type: "number",
              value: lat,
              step: "0.00001",
              onChange: this.onChange("lat")
            })
          ),
          _react2.default.createElement(
            "div",
            { className: "col-sm-6" },
            _react2.default.createElement(
              "label",
              null,
              "Longitude"
            ),
            _react2.default.createElement("input", {
              className: "form-control",
              type: "number",
              value: lon,
              step: "0.00001",
              onChange: this.onChange("lon")
            })
          )
        )
      );
    }
  }]);

  return GeoPosition;
}(_react.Component);

exports.default = GeoPosition;