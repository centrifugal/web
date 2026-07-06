import React, { useEffect, useContext, useState, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { red } from '@mui/material/colors'

import { ShellContext } from 'contexts/ShellContext'
import { SettingsContext } from 'contexts/SettingsContext'
import { AdminSettingsContext } from 'contexts/AdminSettingsContext'
import { globalUrlPrefix } from 'config/url'

import { useAuth } from 'react-oidc-context'

import Canvas from './Canvas'

const redTheme = createTheme({ palette: { primary: red } })

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0
  const x = centerX + radius * Math.cos(angleInRadians)
  const y = centerY + radius * Math.sin(angleInRadians)
  return [x, y]
}

function cartesianToPolar(
  centerX: number,
  centerY: number,
  X: number,
  Y: number
) {
  const radians = Math.atan2(Y - centerY, X - centerX)
  return (radians * 180) / Math.PI
}

//@ts-ignore
function Segment(
  ctx: any,
  X: any,
  Y: any,
  x: any,
  y: any,
  radius: any,
  r: any,
  w: any,
  rotate: any,
  speed: any,
  angleDiff: any,
  segmentColor: any
): any {
  //@ts-ignore
  this.ctx = ctx
  //@ts-ignore
  this.init(X, Y, x, y, radius, r, w, rotate, speed, angleDiff, segmentColor)
}

//@ts-ignore
Segment.prototype.init = function init(
  X: any,
  Y: any,
  x: any,
  y: any,
  rad: any,
  r: any,
  w: any,
  rotate: any,
  speed: any,
  angleDiff: any,
  segColor: any
) {
  this.X = X
  this.Y = Y
  this.radius = rad
  this.x = x
  this.y = y
  this.r = r
  this.w = w
  this.c = segColor
  this.rotate = rotate
  this.speed = speed * 60
  this.angleDiff = angleDiff
  this.a = 0
}

//@ts-ignore
Segment.prototype.drawSegment = function drawSegment(
  fromAngle: any,
  toAngle: any,
  rotateAngle: any
) {
  this.ctx.translate(this.x, this.y)
  this.ctx.rotate((rotateAngle * Math.PI) / 180)
  this.ctx.translate(-this.x, -this.y)
  this.ctx.beginPath()

  const res = polarToCartesian(this.x, this.y, this.r, fromAngle)
  const startX = res[0]
  const startY = res[1]
  const toRes = polarToCartesian(this.x, this.y, this.r, toAngle)
  const endX = toRes[0]
  const endY = toRes[1]

  const anotherX = startX - this.w
  const anotherY = endY - this.w
  const innerAngleStart = cartesianToPolar(this.x, this.y, anotherX, startY)
  const innerAngleEnd = cartesianToPolar(this.x, this.y, endX, anotherY)
  const toAngleRad = (toAngle * Math.PI) / 180
  const fromAngleRad = (fromAngle * Math.PI) / 180
  const innerAngleStartRad = (innerAngleStart * Math.PI) / 180
  const innerAngleEndRad = (innerAngleEnd * Math.PI) / 180

  this.ctx.arc(this.x, this.y, this.r, toAngleRad, fromAngleRad, true)
  this.ctx.arc(
    this.x,
    this.y,
    this.r - this.w,
    innerAngleStartRad,
    innerAngleEndRad,
    false
  )
  this.ctx.closePath()
  this.ctx.fillStyle = this.c
  this.ctx.fill()
  this.ctx.stroke()
}

//@ts-ignore
Segment.prototype.draw = function draw() {
  this.ctx.save()
  this.ctx.lineWidth = 3
  this.ctx.strokeStyle = this.c
  this.ctx.shadowColor = this.c
  this.drawSegment(
    4 + this.angleDiff,
    86 - this.angleDiff,
    this.rotate + this.a
  )
  this.ctx.restore()
}

Segment.prototype.resize = function resize() {
  this.x = this.X / 2
  this.y = this.Y / 2
}

Segment.prototype.updateParams = function updateParams(elapsedTime: any) {
  this.a += (this.speed * elapsedTime * this.radius) / this.r
}

Segment.prototype.render = function render(elapsedTime: any) {
  this.updateParams(elapsedTime)
  this.draw()
}

//@ts-ignore
function Bubble(
  ctx: any,
  canvasWidth: number,
  canvasHeight: number,
  isDarkTheme: boolean
) {
  //@ts-ignore
  this.ctx = ctx
  //@ts-ignore
  this.isDarkTheme = isDarkTheme
  //@ts-ignore
  this.canvasWidth = canvasWidth
  //@ts-ignore
  this.canvasHeight = canvasHeight
  //@ts-ignore
  this.color = 'rgba(46, 3, 15, 0.35)'
  //@ts-ignore
  this.x = Math.random() * canvasWidth
  //@ts-ignore
  this.y = Math.random() * canvasHeight
  //@ts-ignore
  this.radius = (Math.random() * canvasWidth) / 60 + 5
  //@ts-ignore
  this.vx = (Math.random() - 0.5) * 70
  //@ts-ignore
  this.vy = (Math.random() - 0.5) * 70
  //@ts-ignore
  this.alpha = Math.random() * 0.3 + 0.7
  //@ts-ignore
  this.pulse = 0
  //@ts-ignore
  this.pulseSpeed = 0
  //@ts-ignore
  this.burstInterval = Math.random() * 50 + 3
  //@ts-ignore
  this.timeSinceLastBurst = 0
  //@ts-ignore
  this.bursting = false
  //@ts-ignore
  this.burstProgress = 0
  //@ts-ignore
  this.burstDuration = 0.5
  //@ts-ignore
  this.appearDuration = Math.random() * 1 + 5
  //@ts-ignore
  this.appearProgress = 0
  //@ts-ignore
  this.splashParticles = null
}

//@ts-ignore
Bubble.prototype.reset = function () {
  this.x = Math.random() * this.canvasWidth
  this.y = Math.random() * this.canvasHeight
  this.radius = (Math.random() * this.canvasWidth) / 60 + 5
  this.vx = (Math.random() - 0.5) * 50
  this.vy = (Math.random() - 0.5) * 50
  this.alpha = Math.random() * 0.3 + 0.7
  this.pulse = Math.random() * Math.PI * 2
  this.pulseSpeed = Math.random() * 2 + 1
  this.burstInterval = Math.random() * 50 + 3
  this.timeSinceLastBurst = 0
  this.bursting = false
  this.burstProgress = 0
  this.appearProgress = 0
  this.splashParticles = null
}

//@ts-ignore
Bubble.prototype.update = function (elapsedTime: any) {
  this.x += this.vx * elapsedTime
  this.y += this.vy * elapsedTime

  if (this.x < 0) {
    this.x = 0
    this.vx *= -1
  }
  if (this.x > this.canvasWidth) {
    this.x = this.canvasWidth
    this.vx *= -1
  }
  if (this.y < 0) {
    this.y = 0
    this.vy *= -1
  }
  if (this.y > this.canvasHeight) {
    this.y = this.canvasHeight
    this.vy *= -1
  }

  if (!this.bursting) {
    this.pulse += this.pulseSpeed * elapsedTime
    this.appearProgress = Math.min(
      1,
      this.appearProgress + elapsedTime / this.appearDuration
    )
    this.timeSinceLastBurst += elapsedTime
    if (this.timeSinceLastBurst >= this.burstInterval) {
      this.bursting = true
      this.burstProgress = 0
      let numSplashes = Math.floor(Math.random() * 6) + 10
      this.splashParticles = []
      for (let i = 0; i < numSplashes; i++) {
        let angle = Math.random() * Math.PI * 2
        let speed = Math.random() * 50 + 50
        let length = Math.random() * 10 + 5
        this.splashParticles.push({
          angle: angle,
          speed: speed,
          length: length,
        })
      }
    }
  } else {
    this.burstProgress += elapsedTime / this.burstDuration
    if (this.burstProgress >= 1) {
      this.reset()
    }
  }
}

//@ts-ignore
Bubble.prototype.draw = function () {
  const ctx = this.ctx
  ctx.save()

  if (!this.bursting) {
    const dynamicAlpha =
      (this.alpha + 0.3 * Math.sin(this.pulse)) * this.appearProgress
    ctx.globalAlpha = Math.max(0, Math.min(0.7, dynamicAlpha))

    const gradient = ctx.createRadialGradient(
      this.x,
      this.y,
      0,
      this.x,
      this.y,
      this.radius
    )
    if (this.isDarkTheme) {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
      gradient.addColorStop(0.95, 'rgba(98, 86, 86, 0.04)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.33)')
    } else {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.68)')
      gradient.addColorStop(0.95, 'rgba(139, 131, 148, 0.17)')
      gradient.addColorStop(1, 'rgba(6, 5, 81, 0.23)')
    }

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fill()
  } else {
    const burstRadius = this.radius * (1 + 0.1 * this.burstProgress)
    ctx.globalAlpha = Math.max(0, 1 - this.burstProgress)
    const gradient = ctx.createRadialGradient(
      this.x,
      this.y,
      0,
      this.x,
      this.y,
      burstRadius
    )
    if (this.isDarkTheme) {
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)')
      gradient.addColorStop(0.6, 'rgba(100, 82, 82, 0.29)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    } else {
      gradient.addColorStop(0, 'rgba(217, 217, 217, 0.9)')
      gradient.addColorStop(0.6, 'rgba(177,246,255,0.29)')
      gradient.addColorStop(1, 'rgba(204, 204, 204, 0)')
    }
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(this.x, this.y, burstRadius, 0, Math.PI * 2)
    ctx.fill()

    if (this.splashParticles) {
      for (let i = 0; i < this.splashParticles.length; i++) {
        let p = this.splashParticles[i]
        let offset = p.speed * this.burstProgress
        let splashX = this.x + Math.cos(p.angle) * offset
        let splashY = this.y + Math.sin(p.angle) * offset
        let splashRadius = p.length * (1 - this.burstProgress)
        ctx.globalAlpha = Math.max(0, 1 - this.burstProgress)
        if (this.isDarkTheme) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.71)'
        } else {
          ctx.fillStyle = 'rgb(174,174,174)'
        }
        ctx.beginPath()
        ctx.arc(splashX, splashY, 0.1 * splashRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.restore()
}

//@ts-ignore
Bubble.prototype.render = function (elapsedTime: any) {
  this.update(elapsedTime)
  this.draw()
}

function drawLogo(
  ctx: any,
  canvasWidth: number,
  canvasHeight: number,
  colorMode: string
) {
  const X = canvasWidth
  const Y = canvasHeight
  const centerX = X / 2
  const centerY = Y / 2

  const isDarkTheme = colorMode === 'dark'
  let outerSegmentColor, innnerSegmentColor
  if (isDarkTheme) {
    outerSegmentColor = '#6e2b2b'
    innnerSegmentColor = '#6e2b2b'
  } else {
    outerSegmentColor = '#e6e8eb'
    innnerSegmentColor = '#ffd4d4'
  }

  const bubbleCount = 32
  const bubbles: any[] = []

  const segments: any[] = []
  const radius = Y / 11
  const lw = radius / 14

  //@ts-ignore
  window.requestAnimationFrame =
    window.requestAnimationFrame || //@ts-ignore
    window.mozRequestAnimationFrame || //@ts-ignore
    window.webkitRequestAnimationFrame || //@ts-ignore
    window.msRequestAnimationFrame || //@ts-ignore
    function requestAnimationFrame(cb) {
      setTimeout(cb, 17)
    }

  for (let i = 0; i < bubbleCount; i++) {
    //@ts-ignore
    bubbles.push(new Bubble(ctx, X, Y, isDarkTheme))
  }

  // Add click event listener to canvas
  const canvas = ctx.canvas
  if (canvas && !canvas.hasClickListener) {
    canvas.hasClickListener = true
    canvas.addEventListener('click', (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const clickY = event.clientY - rect.top

      bubbles.forEach(bubble => {
        const dx = clickX - bubble.x
        const dy = clickY - bubble.y
        if (Math.sqrt(dx * dx + dy * dy) <= bubble.radius) {
          if (!bubble.bursting) {
            bubble.bursting = true
            bubble.burstProgress = 0
            let numSplashes = Math.floor(Math.random() * 6) + 10
            bubble.splashParticles = []
            for (let i = 0; i < numSplashes; i++) {
              let angle = Math.random() * Math.PI * 2
              let speed = Math.random() * 50 + 50
              let length = Math.random() * 10 + 5
              bubble.splashParticles.push({ angle, speed, length })
            }
          }
        }
      })
    })
  }

  //@ts-ignore
  segments.push(
    //@ts-ignore
    new Segment(
      ctx,
      X,
      Y,
      centerX,
      centerY,
      radius,
      radius * 2.65,
      lw * 9,
      0,
      -1.5,
      0,
      outerSegmentColor
    )
  )
  segments.push(
    //@ts-ignore
    new Segment(
      ctx,
      X,
      Y,
      centerX,
      centerY,
      radius,
      radius * 2.65,
      lw * 9,
      90,
      -1.5,
      0,
      outerSegmentColor
    )
  )
  segments.push(
    //@ts-ignore
    new Segment(
      ctx,
      X,
      Y,
      centerX,
      centerY,
      radius,
      radius * 2.65,
      lw * 9,
      180,
      -1.5,
      0,
      outerSegmentColor
    )
  )
  segments.push(
    //@ts-ignore
    new Segment(
      ctx,
      X,
      Y,
      centerX,
      centerY,
      radius,
      radius * 2.65,
      lw * 9,
      270,
      -1.5,
      0,
      outerSegmentColor
    )
  )
  segments.push(
    //@ts-ignore
    new Segment(
      ctx,
      X,
      Y,
      centerX,
      centerY,
      radius,
      radius * 1.45,
      lw * 8,
      45,
      1.5,
      2,
      innnerSegmentColor
    )
  )
  segments.push(
    //@ts-ignore
    new Segment(
      ctx,
      X,
      Y,
      centerX,
      centerY,
      radius,
      radius * 1.45,
      lw * 8,
      135,
      1.5,
      2,
      innnerSegmentColor
    )
  )
  segments.push(
    //@ts-ignore
    new Segment(
      ctx,
      X,
      Y,
      centerX,
      centerY,
      radius,
      radius * 1.45,
      lw * 8,
      225,
      1.5,
      2,
      innnerSegmentColor
    )
  )

  let lastRenderTime = 0

  function render(currentTime: any) {
    const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000

    ctx.clearRect(0, 0, X, Y)
    for (let i = 0; i < bubbles.length; i++) {
      bubbles[i].render(secondsSinceLastRender)
    }
    for (let i = 0; i < segments.length; i += 1) {
      segments[i].render(secondsSinceLastRender)
    }

    lastRenderTime = currentTime
    requestAnimationFrame(render)
  }

  requestAnimationFrame(render)
}

interface LoginProps {
  handleLogin: (password: string) => Promise<void>
}

const MemoCanvas = React.memo(props => {
  const settingsContext = useContext(SettingsContext)
  const colorMode = settingsContext.getUserSettings().colorMode
  return (
    <Canvas
      width={window.innerWidth}
      height={window.innerHeight}
      draw={ctx => {
        drawLogo(ctx, window.innerWidth, window.innerHeight, colorMode)
      }}
    />
  )
})

export function Login({ handleLogin }: LoginProps) {
  const auth = useAuth()

  const { setTitle } = useContext(ShellContext)

  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const adminSettingsContext = useContext(AdminSettingsContext)

  const adminSettings = adminSettingsContext.getAdminSettings()
  const edition = adminSettings.edition
  let nameSuffix = ''
  if (edition === 'pro') {
    nameSuffix = ' PRO'
  }

  const useIDP = adminSettings.oidc !== undefined
  const usePKCE = adminSettings.oidc?.pkce === true

  // Store refreshed auth_url in ref to avoid re-renders
  const freshAuthUrlRef = useRef<string | undefined>(
    adminSettings.oidc?.auth_url
  )

  useEffect(() => {
    setTitle('Centrifugo' + nameSuffix)
  }, [setTitle, nameSuffix])

  // Periodically refresh admin settings to get fresh auth_url with non-expired state
  useEffect(() => {
    const refreshAuthUrl = async () => {
      try {
        const token = localStorage.getItem('token')
        const headers: HeadersInit = {}
        if (token) {
          headers['Authorization'] = `token ${token}`
        }

        const response = await fetch(`${globalUrlPrefix}admin/init`, {
          headers,
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          // Store in ref to avoid re-renders that would restart canvas animation
          if (data.oidc?.auth_url) {
            freshAuthUrlRef.current = data.oidc.auth_url
          }
        }
      } catch (error) {
        console.error('Error refreshing auth URL:', error)
      }
    }

    // Set up interval to refresh every 30 sec.
    const intervalId = setInterval(refreshAuthUrl, 30 * 1000)

    // Clean up interval on unmount
    return () => clearInterval(intervalId)
  }, [])

  const handleFormSubmit = async (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setLoginError('')
    try {
      await handleLogin(password)
    } catch (err) {
      setLoginError(
        err instanceof Error && err.message === '401'
          ? 'Invalid password'
          : 'Login failed, please try again'
      )
    }
  }

  const handleServerSideOIDCLogin = () => {
    // For server-side OIDC, redirect to the authorization URL
    // Use freshAuthUrlRef to get the most recent auth_url with non-expired state
    const authUrl = freshAuthUrlRef.current || adminSettings.oidc?.auth_url
    if (authUrl) {
      window.location.href = authUrl
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <ThemeProvider theme={redTheme}>
        <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
      </ThemeProvider>
      <Typography component="h1" variant="h4">
        {`CENTRIFUGO` + nameSuffix}
      </Typography>
      <Box
        component="form"
        onSubmit={handleFormSubmit}
        noValidate
        sx={{ mt: 1 }}
      >
        <input hidden type="text" autoComplete="username" />
        {useIDP ? (
          <></>
        ) : (
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            onChange={event => {
              setPassword(event.target.value)
              if (loginError) setLoginError('')
            }}
            value={password}
            color="primary"
            error={!!loginError}
            helperText={loginError}
          />
        )}

        <ThemeProvider theme={redTheme}>
          {useIDP && usePKCE ? (
            <Button
              type="button"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 3, mb: 2 }}
              onClick={() => void auth.signinRedirect()}
            >
              Log in with {adminSettings.oidc?.display_name}
            </Button>
          ) : useIDP && !usePKCE ? (
            <Button
              type="button"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 3, mb: 2 }}
              onClick={handleServerSideOIDCLogin}
            >
              Log in with {adminSettings.oidc?.display_name}
            </Button>
          ) : (
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              sx={{
                mt: 3,
                mb: 2,
                '&.Mui-disabled': {
                  backgroundColor: '#ccc',
                  color: '#666',
                  opacity: 0.7,
                },
              }}
              disabled={password.trim() === ''}
            >
              Log in
            </Button>
          )}
        </ThemeProvider>
      </Box>
      <MemoCanvas />
    </Box>
  )
}
