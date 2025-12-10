import React, { useEffect, useState } from 'react';

function CoinChaser() {
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasInteracted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasInteracted]);

  const handleIframeInteraction = () => {
    setHasInteracted(true);
  };

  return (
    <div 
      className="coin-chaser" 
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}
      onClick={handleIframeInteraction}
    >
      <iframe
        src="/coin-chaser/pilot-platformer.html"
        style={{ width: '60%', height: '60%', border: 'none' }}
        allowFullScreen
        title="Coin Chaser"
      ></iframe>
    </div>
  );
}

export default CoinChaser;