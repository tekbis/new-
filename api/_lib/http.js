async function readJsonBody(req) {
  try {
    if (req.body != null) {
      if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
      return req.body;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    const err = new Error('Invalid request.');
    err.statusCode = 400;
    throw err;
  }
}

function json(res, status, payload) {
  return res.status(status).json(payload);
}

module.exports = {
  readJsonBody: readJsonBody,
  json: json
};
