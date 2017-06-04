import React from "react";
import PropTypes from "prop-types";

import BaseInput from "./BaseInput";

function fromJSONDate(jsonDate) {
  return jsonDate ? jsonDate.slice(0, 19) : "";
}

function toJSONDate(dateString) {
  if (dateString) {
    return new Date(dateString+":00").toJSON();
  }
}

function TimeWidget(props) {
  const { onChange } = props;
  return (
    <BaseInput
      type="time"
      {...props}
      onChange={value => onChange(toJSONDate(value) || undefined)}
    />
  );
}

if (process.env.NODE_ENV !== "production") {
  TimeWidget.propTypes = {
    value: PropTypes.string,
  };
}

export default TimeWidget;
