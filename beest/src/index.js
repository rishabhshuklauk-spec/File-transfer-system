import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Redis } from '@upstash/redis/cloudflare';
import { AwsClient } from 'aws4fetch';

const app = new Hono();

app.use('/*', cors());

app.post('/upload', async (c) => {
	const redis = new Redis({
		url: c.env.UPSTASH_URL,
		token: c.env.UPSTASH_TOKEN,
	});

	const b2 = new AwsClient({
		accessKeyId: c.env.B2_KEY_ID,
		secretAccessKey: c.env.B2_APPLICATION_KEY,
		service: 's3',
		region: c.env.B2_REGION,
	});

	const file = await c.req.blob();
	const fileBuffer = await file.arrayBuffer();

	const objectKey = crypto.randomUUID();
	const token = Math.random().toString(36).substring(2, 8);

	const b2Url = new URL(`${c.env.B2_ENDPOINT}/${c.env.B2_BUCKET_NAME}/${objectKey}`);

	await b2.fetch(b2Url, {
		method: 'PUT',
		body: fileBuffer,
	});

	await redis.set(token, objectKey, { ex: 86400 });

	return c.json({ success: true, token });
});

app.get('/download/:token', async (c) => {
	const token = c.req.param('token');

	const redis = new Redis({
		url: c.env.UPSTASH_URL,
		token: c.env.UPSTASH_TOKEN,
	});

	const b2 = new AwsClient({
		accessKeyId: c.env.B2_KEY_ID,
		secretAccessKey: c.env.B2_APPLICATION_KEY,
		service: 's3',
		region: c.env.B2_REGION,
	});

	const objectKey = await redis.get(token);

	if (!objectKey) {
		return c.json({ error: 'File not found or already deleted' }, 404);
	}

	const b2Url = new URL(`${c.env.B2_ENDPOINT}/${c.env.B2_BUCKET_NAME}/${objectKey}`);

	const fileResponse = await b2.fetch(b2Url, { method: 'GET' });
	const fileBlob = await fileResponse.blob();

	await b2.fetch(b2Url, { method: 'DELETE' });
	await redis.del(token);

	return new Response(fileBlob);
});

app.get('/exists/:token', async (c) => {
	const token = c.req.param('token');

	const redis = new Redis({
		url: c.env.UPSTASH_URL,
		token: c.env.UPSTASH_TOKEN,
	});

	const exists = await redis.exists(token);

	return c.json({ exists: exists === 1 });
});

app.get('/', (c) => {
	return c.html(`
    <html>
      <head><title>Beest API</title></head>
      <body style="background: #111; color: #0f0; font-family: monospace; text-align: center; padding-top: 50px;">
        <h1>Beest Backend is active.</h1>
      </body>
    </html>
  `);
});

export default app;
