const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://v3.football.api-sports.io',
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
      onProxyReq(proxyReq) {
        proxyReq.setHeader('x-apisports-key', process.env.API_SPORTS_KEY || '');
      },
    })
  );
};
