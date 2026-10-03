function Face({ x = 0, y = 0, skin = '#f4d982', sleepy = false }: { x?: number; y?: number; skin?: string; sleepy?: boolean }) {
  return <g transform={`translate(${x} ${y})`} fill="#281c13" stroke="none">
    <ellipse cx="-7" cy="-3" rx="4.5" ry="8" /><ellipse cx="6" cy="-3" rx="4.5" ry="8" />
    <path d="m-11-7 5 3-5 2m13-5 5 3-5 2" fill={skin} />
    {sleepy && <path d="M-12-11h24v9l-24-3Z" fill={skin} />}
    <path d="M-8 9q8 3 16-2C8 22-4 23-8 9Z" />
    <path d="m-5 10 9-.3-2 3-5-.1Z" fill="#f9e9c8" />
    <path d="M-1 19q3-4 6-2l-3 3Z" fill="#b95238" />
  </g>
}

export function WeatherIcon({ icon, size = 56 }: { icon: string; size?: number }) {
  const cloud = 'M15 47C1 47 1 26 18 25C18 8 44 5 50 23C68 15 81 34 69 45C67 48 62 49 57 49Z'
  return <svg className={`weather-icon weather-icon--${icon}`} width={size} height={size} viewBox="0 0 80 80" fill="none" stroke="#281c13" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {icon === 'sun' ? <><path fill="#d7a643" d="m40 2 5 13 12-8 1 15 15-2-7 13 13 7-13 7 7 13-15-2-1 15-12-8-5 13-5-13-12 8-1-15-15 2 7-13L1 40l13-7-7-13 15 2 1-15 12 8Z" /><circle cx="40" cy="40" r="24" fill="#f4d982" /><Face x={40} y={40} /></>
      : icon === 'quake' ? <><path fill="#9e8053" d="m11 69 25-55 18 33 9-18 15 40Z" /><path d="m26 36 10-22 9 17-10-5Z" fill="#e4c9a0" /><Face x={38} y={51} skin="#9e8053" /><path d="m7 25-4 9 5 7-5 10m67-43 6 10-5 7 6 9" /></>
      : icon === 'drought' ? <><path fill="#d6b66d" d="M2 69q18-22 38-5 17-28 38 5Z" /><circle cx="58" cy="21" r="14" fill="#d7a643" /><Face x={58} y={22} /><path d="M19 63V33m0 17H9V40m10 4h11V32" stroke="#727d49" strokeWidth="7" /></>
      : icon === 'calm' ? <><path fill="#859350" d="M11 64C5 23 43 11 68 17 60 49 39 68 11 64Z" /><path d="m12 63 37-32m-24 19-4-14m13 5 17 2" /><Face x={42} y={36} /></>
      : <><path d={cloud} fill={icon === 'storm' ? '#9c89ab' : '#abbcc0'} /><Face x={38} y={33} skin={icon === 'storm' ? '#9c89ab' : '#abbcc0'} sleepy={icon === 'rain'} />
        {icon === 'storm' ? <path fill="#dab74c" d="m45 47-14 17h10l-5 14 19-20H44l7-11Z" />
          : icon === 'wind' ? <path d="M8 59h44q14 0 14 9t-11 7M6 67h30" stroke="#806790" strokeWidth="3" />
          : icon === 'fog' ? <path d="M4 57h65M15 66h59M5 75h53" stroke="#908c91" strokeWidth="4" />
          : <g fill="#668a9a"><path d="M15 55q-9 13-2 15t6-9Z" /><path d="M38 55q-9 13-2 15t6-9Z" /><path d="M61 55q-9 13-2 15t6-9Z" /></g>}
      </>}
  </svg>
}
