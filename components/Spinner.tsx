
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-amber-400" role="status">
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;