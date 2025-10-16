import React from 'react';

// シンプルな桜アイコンSVG (Emoji置換用)
// サイズは親要素で font-size によらず固定されるよう width/height 明示
export const SakuraIcon: React.FC<{ size?: number; className?: string }>=({ size=32, className })=>{
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="桜"
      className={className}
      style={{ display:'inline-block', verticalAlign:'middle' }}
    >
      <defs>
        <radialGradient id="petalGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffd5e6" />
          <stop offset="70%" stopColor="#ff8fb8" />
          <stop offset="100%" stopColor="#ff6fa5" />
        </radialGradient>
        <linearGradient id="centerGrad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffca28" />
          <stop offset="100%" stopColor="#ff9100" />
        </linearGradient>
      </defs>
      {/* 花びら5枚 */}
      <g transform="translate(32,32)">
        {Array.from({length:5}).map((_,i)=>{
          const angle = (i*72); // 360/5
          return (
            <path
              key={i}
              d="M0 -18 C 6 -22 11 -22 14 -14 C 18 -6 14 -2 8 0 C 14 2 18 6 14 14 C 11 22 6 22 0 18 C -6 22 -11 22 -14 14 C -18 6 -14 2 -8 0 C -14 -2 -18 -6 -14 -14 C -11 -22 -6 -22 0 -18 Z"
              fill="url(#petalGrad)"
              stroke="#e04886"
              strokeWidth="1.2"
              transform={`rotate(${angle})`}
            />
          );
        })}
        <circle r="5" fill="url(#centerGrad)" stroke="#e06d00" strokeWidth="1" />
        <circle r="2" fill="#fff9c4" />
      </g>
    </svg>
  );
};

export default SakuraIcon;
