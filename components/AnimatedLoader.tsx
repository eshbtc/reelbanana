import React from 'react';

const AnimatedLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center">
      <img src="/animated-logo.gif" alt="Creating your movie..." className="w-64 h-64" />
    </div>
  );
};

export default AnimatedLoader;
