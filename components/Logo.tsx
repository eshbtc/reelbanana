import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  onClick?: () => void;
}

const Logo: React.FC<LogoProps> = ({ className = '', width = 64, height = 64, onClick }) => {
  const [imageError, setImageError] = useState(false);

  // Fallback SVG logo if PNG fails to load
  const SvgLogo = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={width}
      height={height}
      className={className}
    >
      <title>Reel Banana Logo</title>
      <path
        d="M52.3,16.2c-7.3-7.3-19.1-7.3-26.4,0c-1.8,1.8-3.3,4-4.5,6.3c-1.1,2.4-1.8,5-2.1,7.6c-0.2,2.6,0.1,5.3,0.7,7.8 c0.7,2.5,1.7,4.9,3,7.1c0.1,0.2,0.3,0.3,0.4,0.3c0.1,0,0.2,0,0.3-0.1c0.2-0.1,0.3-0.3,0.3-0.5c-0.6-2.6-0.9-5.3-0.7-7.9 c0.3-2.5,1-5,2.1-7.3c1.1-2.2,2.6-4.3,4.3-6.1c6.5-6.5,17-6.5,23.5,0c0.1,0.1,0.3,0.2,0.5,0.2c0.2,0,0.3-0.1,0.4-0.2 C52.5,16.7,52.5,16.4,52.3,16.2z"
        fill="#FBBF24"
      />
      <path
        d="M17.6,39.8c0.8,0.3,1.6,0.5,2.5,0.5c3.2,0,6.1-1.2,8.4-3.5c2.3-2.3,3.5-5.2,3.5-8.4c0-0.9-0.2-1.7-0.5-2.5 c-0.1-0.2-0.3-0.3-0.5-0.3c-0.2-0.1-0.4,0-0.5,0.2c-0.3,0.7-0.5,1.5-0.5,2.3c0,2.8-1.1,5.4-3,7.3c-1.9,1.9-4.5,3-7.3,3 c-0.8,0-1.6-0.1-2.3-0.4c-0.2-0.1-0.4,0-0.5,0.1C17.3,39.5,17.4,39.7,17.6,39.8z"
        fill="#8C2B0A"
      />
    </svg>
  );

  const logoContent = imageError ? <SvgLogo /> : (
    <img
      src="/logo-enlarged.png"
      alt="Reel Banana Logo"
      width={width}
      height={height}
      className={className}
      onError={() => setImageError(true)}
    />
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="hover:opacity-80 transition-opacity cursor-pointer"
        title="Go to Home"
      >
        {logoContent}
      </button>
    );
  }

  return logoContent;
};

export default Logo;
