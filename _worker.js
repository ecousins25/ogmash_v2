const dev_debug = false; // Toggle this for detailed logging

const log = (...args) => {
  if (dev_debug) {
    console.log(...args);
  }
};

const logError = (...args) => {
  if (dev_debug) {
    console.error(...args);
  }
};

// Add this helper function at the top with other utility functions
const generateETag = (content, lastModified) => {
  return `W/"${lastModified.getTime().toString(16)}"`;
};

const createCacheResponse = (content, lastModified, etag) => {
  return new Response(content, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'ETag': etag,
      'Last-Modified': lastModified.toUTCString(),
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    log('👋 Step 1: Incoming Request', {
      method: request.method,
      path: path,
      headers: Object.fromEntries(request.headers),
      timestamp: new Date().toISOString()
    });

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      log('🔄 Step 2a: Handling CORS Preflight');
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
        },
      });
    }

    // Handle getMusicList
    if (path === 'getMusicList') {
      log('📋 Step 2b: Fetching Music List');
      try {
        // Check Cloudflare's edge cache first
        const cacheKey = new Request(request.url, request);
        const cache = caches.default;
        
        let response = await cache.match(cacheKey);
        if (response) {
          log('✅ Serving from edge cache');
          return response;
        }

        // If not in edge cache, fetch from R2
        const object = await env.ogmash_BUCKET.get('music-list.json');
        if (!object) {
          logError('❌ Music list not found');
          return new Response('File not found', { status: 404 });
        }

        const lastModified = new Date(object.uploaded);
        const etag = generateETag(object, lastModified);

        // Check client cache validation
        const clientETag = request.headers.get('If-None-Match');
        const clientLastModified = request.headers.get('If-Modified-Since');

        if (clientETag === etag || (clientLastModified && new Date(clientLastModified) >= lastModified)) {
          log('✅ Client has latest version - returning 304');
          const notModifiedResponse = new Response(null, {
            status: 304,
            headers: {
              'Cache-Control': 'public, max-age=3600',
              'ETag': etag,
              'Last-Modified': lastModified.toUTCString(),
              'Access-Control-Allow-Origin': '*',
            },
          });
          
          // Store the full response in edge cache
          await cache.put(cacheKey, notModifiedResponse.clone());
          return notModifiedResponse;
        }

        log('✅ Sending fresh music list');
        const freshResponse = createCacheResponse(
          await object.text(),
          lastModified,
          etag
        );

        // Store the response in edge cache
        await cache.put(cacheKey, freshResponse.clone());
        return freshResponse;

      } catch (error) {
        logError('❌ Error fetching music list:', error);
        return new Response('Error fetching music list', { status: 500 });
      }
    }

    // Handle audio files
    if (path.startsWith('audio/')) {
      log('🎵 Step 2c: Processing Audio Request');
      try {
        const audioPath = decodeURIComponent(path.replace('audio/', ''));
        log('📂 Step 3: Fetching audio file:', audioPath);

        const audioFile = await env.ogmash_BUCKET.get(audioPath);
        
        if (!audioFile) {
          logError('❌ Step 3a: Audio file not found:', audioPath);
          return new Response('Audio file not found', { 
            status: 404,
            headers: { 'Access-Control-Allow-Origin': '*' }
          });
        }

        // Get file size
        const fileSize = audioFile.size;
        log('📊 Step 4: File info retrieved', {
          path: audioPath,
          size: fileSize,
          contentType: audioFile.httpMetadata?.contentType,
          timestamp: new Date().toISOString()
        });
        
        // Handle range request
        const range = request.headers.get('range');
        if (range) {
          log('📍 Step 5a: Processing Range Request', {
            range,
            timestamp: new Date().toISOString()
          });

          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          
          const chunksize = (end - start) + 1;
          log('🔢 Step 5b: Range details calculated', { 
            start, 
            end, 
            chunksize, 
            fileSize,
            timestamp: new Date().toISOString()
          });

          const slicedFile = await env.ogmash_BUCKET.get(audioPath, {
            range: { offset: start, length: chunksize }
          });

          if (!slicedFile) {
            throw new Error('Failed to get slice of file');
          }

          const response = new Response(slicedFile.body, {
            status: 206,
            headers: {
              'Content-Type': 'audio/wav',
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize.toString(),
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
              'Cache-Control': 'public, max-age=2592000',
            },
          });

          log('📤 Step 6a: Sending partial response', {
            status: response.status,
            headers: Object.fromEntries(response.headers),
            timestamp: new Date().toISOString()
          });

          return response;
        }

        // Stream the full file if no range is requested
        log('📤 Step 5c: Preparing full file response');
        const response = new Response(audioFile.body, {
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': fileSize.toString(),
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=2592000',
          },
        });

        log('📤 Step 6b: Sending full file response', {
          status: response.status,
          headers: Object.fromEntries(response.headers),
          timestamp: new Date().toISOString()
        });

        return response;

      } catch (error) {
        logError('❌ Step Error: Audio fetch failed', {
          path: path,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        
        return new Response(`Error fetching audio: ${error.message}`, { 
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    log('⚠️ Step 2d: No matching route found');
    return new Response('Not Found', { 
      status: 404,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
};
