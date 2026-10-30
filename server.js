// Entry point for Phusion Passenger in cPanel
import('./dist/server.cjs').catch(() => import('./server.cjs'));
