import React from 'react';

function HouseAlwaysWins() {
  return (
    <div className="house-always-wins" style={{ height: '100vh', width: '100vw', paddingBottom: '20px', boxSizing: 'border-box' }}>
      <iframe
        src="/house-always-wins/house-always-wins.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allowFullScreen
        title="The House Always Wins"
      ></iframe>
    </div>
  );
}

export default HouseAlwaysWins;
