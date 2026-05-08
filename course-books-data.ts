import React from 'react';

export const Logo = ({ className }: { className?: string }) => (
  <img 
    src="/logo.svg" 
    alt="Maylang Logo" 
    className={className}
    referrerPolicy="no-referrer"
  />
);
