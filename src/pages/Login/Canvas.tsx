import React from 'react';

interface CanvasProps {
  draw: (context: any) => void
  height: number
  width: number
}

const Canvas = ({ draw, height, width }: CanvasProps) => {
    const canvas = React.useRef<HTMLCanvasElement | null>(null);

    React.useEffect(() => {
      if (canvas && canvas.current) {
        const context = canvas.current.getContext('2d');
        draw(context);
      }
    });

    return (
      <canvas ref={canvas} height={height} width={width} style={{position: 'absolute', zIndex: -1}} />
    );
};

export default Canvas;
