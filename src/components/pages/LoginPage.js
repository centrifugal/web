import React from 'react';
import PropTypes from 'prop-types';
import Canvas from './Canvas';

const classNames = require('classnames');

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  const x = centerX + (radius * Math.cos(angleInRadians));
  const y = centerY + (radius * Math.sin(angleInRadians));
  return [x, y];
}

function cartesianToPolar(centerX, centerY, X, Y) {
  const radians = Math.atan2(Y - centerY, X - centerX);
  return (radians * 180) / Math.PI;
}

function Segment(ctx, X, Y, x, y, radius, r, w, rotate, speed, angleDiff, segmentColor) {
  this.ctx = ctx;
  this.init(X, Y, x, y, radius, r, w, rotate, speed, angleDiff, segmentColor);
}

Segment.prototype.init = function init(X, Y, x, y, rad, r, w, rotate, speed, angleDiff, segColor) {
  this.X = X;
  this.Y = Y;
  this.radius = rad;
  this.x = x;
  this.y = y;
  this.r = r;
  this.w = w;
  this.c = segColor;
  this.rotate = rotate;
  this.speed = speed;
  this.angleDiff = angleDiff;
  this.a = 0;
};

Segment.prototype.drawSegment = function drawSegment(fromAngle, toAngle, rotateAngle) {
  this.ctx.translate(this.x, this.y);
  this.ctx.rotate((rotateAngle * Math.PI) / 180);
  this.ctx.translate(-this.x, -this.y);
  this.ctx.beginPath();

  const res = polarToCartesian(this.x, this.y, this.r, fromAngle);
  const startX = res[0];
  const startY = res[1];
  const toRes = polarToCartesian(this.x, this.y, this.r, toAngle);
  const endX = toRes[0];
  const endY = toRes[1];

  const anotherX = startX - this.w;
  const anotherY = endY - this.w;
  const innerAngleStart = cartesianToPolar(this.x, this.y, anotherX, startY);
  const innerAngleEnd = cartesianToPolar(this.x, this.y, endX, anotherY);
  const toAngleRad = (toAngle * Math.PI) / 180;
  const fromAngleRad = (fromAngle * Math.PI) / 180;
  const innerAngleStartRad = (innerAngleStart * Math.PI) / 180;
  const innerAngleEndRad = (innerAngleEnd * Math.PI) / 180;

  this.ctx.arc(this.x, this.y, this.r, toAngleRad, fromAngleRad, true);
  this.ctx.arc(this.x, this.y, this.r - this.w, innerAngleStartRad, innerAngleEndRad, false);
  this.ctx.closePath();
  this.ctx.fillStyle = this.c;
  this.ctx.fill();
  this.ctx.stroke();
};

Segment.prototype.draw = function draw() {
  this.ctx.save();
  this.ctx.lineWidth = 3;
  this.ctx.strokeStyle = this.c;
  this.ctx.shadowColor = this.c;
  this.drawSegment(4 + this.angleDiff, 86 - this.angleDiff, this.rotate + this.a);
  this.ctx.restore();
};

Segment.prototype.resize = function resize() {
  this.x = this.X / 2;
  this.y = this.Y / 2;
};

Segment.prototype.updateParams = function updateParams() {
  this.a += (this.speed * this.radius) / this.r;
};

Segment.prototype.render = function render() {
  this.updateParams();
  this.draw();
};

function Line(ctx, X, Y, x, y, lineColor) {
  this.ctx = ctx;
  this.init(X, Y, x, y, lineColor);
}

Line.prototype.init = function init(X, Y, x, y, lineColor) {
  this.X = X;
  this.Y = Y;
  this.x = x;
  this.y = y;
  this.c = lineColor;
  this.lw = 1;
  this.v = {
    x: 2 * Math.random(),
    y: 2 * Math.random(),
  };
};

Line.prototype.draw = function draw() {
  this.ctx.save();
  this.ctx.lineWidth = this.lw;
  this.ctx.strokeStyle = this.c;
  this.ctx.beginPath();
  this.ctx.moveTo(0, this.y);
  this.ctx.lineTo(this.X, this.y);
  this.ctx.stroke();
  this.ctx.lineWidth = this.lw;
  this.ctx.beginPath();
  this.ctx.moveTo(this.x, 0);
  this.ctx.lineTo(this.x, this.Y);
  this.ctx.stroke();
  this.ctx.restore();
};

Line.prototype.updatePosition = function updatePosition() {
  this.x += this.v.x;
  this.y += this.v.y;
};

Line.prototype.wrapPosition = function wrapPosition() {
  if (this.x < 0) this.x = this.X;
  if (this.x > this.X) this.x = 0;
  if (this.y < 0) this.y = this.Y;
  if (this.y > this.Y) this.y = 0;
};

Line.prototype.updateParams = function updateParams() {
};

Line.prototype.render = function render() {
  this.updatePosition();
  this.wrapPosition();
  this.updateParams();
  this.draw();
};

function drawLogo(ctx, canvasWidth, canvasHeight) {
  const X = canvasWidth;
  const Y = canvasHeight;
  const centerX = X / 2;
  const centerY = Y / 2;
  const lineColor = '#7520a0';
  const segmentColor = '#38195f';

  const linesNum = 3;
  const lines = [];

  const segments = [];
  const radius = Y / 10;
  const lw = radius / 16;

  window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame
  || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame
  || function requestAnimationFrame(cb) {
    setTimeout(cb, 17);
  };

  for (let i = 0; i < linesNum; i += 1) {
    const line = new Line(ctx, X, Y, rand(0, X), rand(0, Y), lineColor);
    lines.push(line);
  }

  segments.push(new Segment(
    ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 0, -1.5, 0, segmentColor,
  ));
  segments.push(new Segment(
    ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 90, -1.5, 0, segmentColor,
  ));
  segments.push(new Segment(
    ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 180, -1.5, 0, segmentColor,
  ));
  segments.push(new Segment(
    ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 270, -1.5, 0, segmentColor,
  ));
  segments.push(new Segment(
    ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 45, 1.5, 2, segmentColor,
  ));
  segments.push(new Segment(
    ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 135, 1.5, 2, segmentColor,
  ));
  segments.push(new Segment(
    ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 225, 1.5, 2, segmentColor,
  ));

  function render() {
    ctx.clearRect(0, 0, X, Y);
    for (let i = 0; i < lines.length; i += 1) {
      lines[i].render();
    }
    for (let i = 0; i < segments.length; i += 1) {
      segments[i].render();
    }
    requestAnimationFrame(render);
  }

  render();
  // function onResize() {
  //   X = canvas.width = window.innerWidth;
  //   Y = canvas.height = window.innerHeight;
  //   for (let i = 0; i < segments.length; i++) {
  //       segments[i].resize();
  //   }
  // }

  // window.addEventListener('resize', function() {
  //     onResize();
  // });
}

export default class LoginPage extends React.Component {
  constructor() {
    super();

    this.state = {
      focus: false,
      password: '',
    };
  }

  componentDidMount() {
    // try to login with empty password – maybe admin_insecure option enabled in Centrifugo.
    const { handleLogin } = this.props;
    handleLogin('');
  }

  handleSubmit(e) {
    e.preventDefault();
    const { password } = this.state;
    const { handleLogin } = this.props;
    handleLogin(password);
  }

  updatePasswordValue(evt) {
    this.setState({ password: evt.target.value });
  }

  inputFocus() {
    this.setState({ focus: true });
  }

  inputBlur() {
    this.setState({ focus: false });
  }

  render() {
    const { focus } = this.state;
    const loginClasses = classNames({ login: true, 'login-focus': focus });

    return (
      <div className={loginClasses}>
        <a href="https://github.com/centrifugal/centrifugo" rel="noopener noreferrer" target="_blank">
          <img className="login-forkme" src="https://camo.githubusercontent.com/38ef81f8aca64bb9a64448d0d70f1308ef5341ab/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666f726b6d655f72696768745f6461726b626c75655f3132313632312e706e67" alt="Fork me on GitHub" data-canonical-src="https://s3.amazonaws.com/github/ribbons/forkme_right_darkblue_121621.png" />
        </a>
        <div className="login-body">
          <div className="container">
            <div className="row">
              <div className="col text-center">
                <h1 className="login-heading">CENTRIFUGO</h1>
                <form action="" method="post" className="login-form" onSubmit={this.handleSubmit.bind(this)}>
                  <div className="form-group">
                    <input onChange={this.updatePasswordValue.bind(this)} onFocus={this.inputFocus.bind(this)} onBlur={this.inputBlur.bind(this)} autoComplete="off" className="form-control" type="password" name="password" placeholder="Type password to log in..." />
                  </div>
                  <button type="submit" onFocus={this.inputFocus.bind(this)} onBlur={this.inputBlur.bind(this)} className="btn btn-success login-submit">
                    <i className="fa fa-sign-in-alt" />
                    {' '}
Log In
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
        <Canvas
          width={window.innerWidth}
          height={window.innerHeight}
          draw={(ctx) => {
            drawLogo(ctx, window.innerWidth, window.innerHeight);
          }}
        />
      </div>
    );
  }
}

LoginPage.propTypes = {
  handleLogin: PropTypes.func.isRequired,
};
