import React, { Component } from "react";

export default class Selector extends Component {
  constructor(props) {
    super(props);
    this.state = { current: "Campaign" };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return shouldRender(this, nextProps, nextState);
  }

  onLabelClick = label => {
    return event => {
      event.preventDefault();
      this.setState({ current: label });
      setImmediate(() => this.props.onSelected(samples[label]));
    };
  };

  render() {
    return (
      <ul className="nav nav-pills">
        {Object.keys(samples).map((label, i) => {
          return (
            <li
              key={i}
              role="presentation"
              className={this.state.current === label ? "active" : ""}>
              <a href="#" onClick={this.onLabelClick(label)}>
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    );
  }
}