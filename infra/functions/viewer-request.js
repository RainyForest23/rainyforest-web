import cf from 'cloudfront';

// CloudFront Functions runtime (cloudfront-js-2.0): no npm modules, `handler` must be global.
const redirects = cf.kvs();

async function handler(event) {
  const request = event.request;
  const host = request.headers.host ? request.headers.host.value : '';

  if (host.startsWith('www.')) {
    return movedPermanently(`https://${host.slice(4)}${request.uri}`);
  }

  const lastSegment = request.uri.split('/').pop();
  const isAsset = lastSegment.includes('.');

  if (!isAsset) {
    const key = request.uri.length > 1 ? request.uri.replace(/\/$/, '') : request.uri;
    try {
      return movedPermanently(await redirects.get(key));
    } catch (e) {
      // Not in the redirect map: serve the page.
    }
  }

  if (request.uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!isAsset) {
    request.uri += '/index.html';
  }
  return request;
}

function movedPermanently(location) {
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: location } },
  };
}
