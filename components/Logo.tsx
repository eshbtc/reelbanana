import React from 'react';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

const Logo: React.FC<LogoProps> = ({ className = '', width = 64, height = 64 }) => {
  return (
    <img
      src="/logo.png"
      alt="Reel Banana Logo"
      width={width}
      height={height}
      className={className}
    />
  );
};

export default Logo;
