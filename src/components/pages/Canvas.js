
import React from 'react';
import PropTypes from 'prop-types';

class Canvas extends React.Component {
  constructor() {
    super();
    this.canvas = React.createRef();
  }

  componentDidMount() {
    const ctx = this.canvas.current.getContext('2d');
    const { draw } = this.props;
    draw(ctx);
  }

  render() {
    const { width, height } = this.props;
    return <canvas ref={this.canvas} width={width} height={height} />;
  }
}

Canvas.propTypes = {
  draw: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
};

export default Canvas;
