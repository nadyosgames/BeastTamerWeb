const paths: Record<string, string> = {
  sun: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM12 0v3m0 18v3M0 12h3m18 0h3M3 3l2 2m14 14 2 2M3 21l2-2M19 5l2-2',
  rain: 'M5 15a5 5 0 0 1 0-10 7 7 0 0 1 13 1 4 4 0 1 1 1 9H5Zm1 3-2 4m8-4-2 4m8-4-2 4',
  storm: 'M5 14a5 5 0 0 1 0-10 7 7 0 0 1 13 1 4 4 0 1 1 1 9M13 9l-6 8h5l-2 7 8-10h-5l2-5',
  wind: 'M1 7h14a3 3 0 1 0-3-3M1 12h18a4 4 0 1 1-4 4M1 18h7',
  quake: 'm1 20 8-17 5 10 3-5 6 12H1Zm4-5 4-3 4 4 4-2 3 4',
  fog: 'M5 12a4 4 0 0 1 0-8 7 7 0 0 1 13 1 4 4 0 0 1 1 8M1 17h20M4 21h19',
  drought: 'M1 21h22M3 17l6-8 6 8M14 4h8m-4-4v8M7 21l3-4 3 4',
  calm: 'M1 14h15a4 4 0 1 0-4-4M1 19h9M3 7h6a3 3 0 1 0-3-3',
}

export function WeatherIcon({ icon, size = 56 }: { icon: string; size?: number }) {
  return <svg className={`weather-icon weather-icon--${icon}`} width={size} height={size} viewBox="-2 -2 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[icon] ?? paths.calm} /></svg>
}
