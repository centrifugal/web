import React, { useEffect, useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MuiLink from '@mui/material/Link'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import Tooltip from '@mui/material/Tooltip'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import CssBaseline from '@mui/material/CssBaseline'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container'
import UILink from '@mui/material/Link'
import { ReactComponent as Logo } from 'img/logo.svg'

import { routes } from 'config/routes'
import { ShellContext } from 'contexts/ShellContext'

import { SettingsContext } from '../../contexts/SettingsContext'


import Canvas from './Canvas'

//@ts-ignore
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

//@ts-ignore
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    const x = centerX + (radius * Math.cos(angleInRadians));
    const y = centerY + (radius * Math.sin(angleInRadians));
    return [x, y];
}

//@ts-ignore
function cartesianToPolar(centerX, centerY, X, Y) {
    const radians = Math.atan2(Y - centerY, X - centerX);
    return (radians * 180) / Math.PI;
}

//@ts-ignore
function Segment(ctx, X, Y, x, y, radius, r, w, rotate, speed, angleDiff, segmentColor): any {
    //@ts-ignore
    this.ctx = ctx;
    //@ts-ignore
    this.init(X, Y, x, y, radius, r, w, rotate, speed, angleDiff, segmentColor);
}

//@ts-ignore
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
}

//@ts-ignore
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

//@ts-ignore
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

//@ts-ignore
function Line(ctx, X, Y, x, y, lineColor) {
    //@ts-ignore
    this.ctx = ctx;
    //@ts-ignore
    this.init(X, Y, x, y, lineColor);
}

//@ts-ignore
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

function drawLogo(ctx: any, canvasWidth: number, canvasHeight: number, colorMode: string) {
    const X = canvasWidth;
    const Y = canvasHeight;
    const centerX = X / 2;
    const centerY = Y / 2;
    
    let lineColor = '#fac5cb';
    let segmentColor = '#fac5cb';
    if (colorMode === 'dark') {
        lineColor = '#9232d9'
        segmentColor = '#431d5e'
    }

    const linesNum = 3;
    const lines: any[] = [];

    const segments: any[] = [];
    const radius = Y / 10;
    const lw = radius / 16;

    //@ts-ignore
    window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame
    //@ts-ignore
        || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame
        || function requestAnimationFrame(cb) {
            setTimeout(cb, 17);
        };

    for (let i = 0; i < linesNum; i += 1) {
        //@ts-ignore
        const line = new Line(ctx, X, Y, rand(0, X), rand(0, Y), lineColor);
        lines.push(line);
    }

    //@ts-ignore
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 0, -1.5, 0, segmentColor,
    ));
    //@ts-ignore
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 90, -1.5, 0, segmentColor,
    ));
    //@ts-ignore
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 180, -1.5, 0, segmentColor,
    ));
    //@ts-ignore
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 270, -1.5, 0, segmentColor,
    ));
    //@ts-ignore
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 45, 1.5, 2, segmentColor,
    ));
    //@ts-ignore
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 135, 1.5, 2, segmentColor,
    ));
    //@ts-ignore
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

interface LoginProps {
    handleLogin: (password: string) => void
}

interface MemoCanvasProps {
    colorMode: 'dark' | 'light'
}

const MemoCanvas = React.memo(props => {
    const settingsContext = useContext(SettingsContext)
    const colorMode = settingsContext.getUserSettings().colorMode
    return <Canvas
        width={window.innerWidth}
        height={window.innerHeight}
        draw={(ctx) => {
            drawLogo(ctx, window.innerWidth, window.innerHeight, colorMode);
        }}
    />
});

export function Login({ handleLogin }: LoginProps) {
    //   const { setTitle } = useContext(ShellContext)
    //   const [roomName, setRoomName] = useState(uuid())
    const navigate = useNavigate()

    const [password, setPassword] = useState('')

    //   useEffect(() => {
    //     setTitle('Centrifugo')
    //   }, [setTitle])

    //   const handleRoomNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    //     const { value } = event.target
    //     setRoomName(value)
    //   }

    const handleFormSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()
        handleLogin(password)
    }

    // const canvas = React.memo(() => {
    //     return (

    //     )
    // });

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh'
            }}
        >
            <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                <LockOutlinedIcon />
            </Avatar>
            <Typography component="h1" variant="h4">
                CENTRIFUGO
            </Typography>
            <Box
                component="form"
                onSubmit={handleFormSubmit}
                noValidate
                sx={{ mt: 1 }}
            >
                {/* <TextField
        margin="normal"
        required
        fullWidth
        id="email"
        label="Email Address"
        name="email"
        autoComplete="email"
        autoFocus
      /> */}
                <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Password"
                    type="password"
                    id="password"
                    autoComplete="current-password"
                    onChange={event => setPassword(event.target.value)}
                    value={password}
                />
                {/* <FormControlLabel
        control={<Checkbox value="remember" color="primary" />}
        label="Remember me"
      /> */}
                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    sx={{ mt: 3, mb: 2 }}
                >
                    Log In
                </Button>
            </Box>
            <MemoCanvas />
        </Box>
    )
}
