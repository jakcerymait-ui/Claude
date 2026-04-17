export default async function handler(req, res) {
  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const endpoint = pathParts.join('/');

  const params = new URLSearchParams();
  Object.entries(req.query).forEach(([k, v]) => {
    if (k !== 'path') params.append(k, v);
  });

  const url = `https://v3.football.api-sports.io/${endpoint}${params.toString() ? '?' + params.toString() : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: { 'x-apisports-key': process.env.API_SPORTS_KEY },
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ errors: [{ bug: err.message }] });
  }
}
