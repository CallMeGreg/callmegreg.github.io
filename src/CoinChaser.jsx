import React from 'react';

function CoinChaser() {
  return (
    <div className="coin-chaser" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
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