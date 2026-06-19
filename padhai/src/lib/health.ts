export interface Health {
  status: 'ok';
  service: 'padhai';
  timestamp: string;
}

export function buildHealth(now: Date = new Date()): Health {
  return {
    status: 'ok',
    service: 'padhai',
    timestamp: now.toISOString(),
  };
}
