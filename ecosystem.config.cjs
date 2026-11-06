module.exports = {
  apps: [
    {
      name: 'phd-finder',
      script: 'node_modules/.bin/tsx',
      args: 'src/server.ts',
      cwd: '/var/www/phd',
      env_file: '/var/www/phd/.env',
      env: {
        PORT: 8787,
        NODE_ENV: 'production',
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
