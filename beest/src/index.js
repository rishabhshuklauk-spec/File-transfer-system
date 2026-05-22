import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AwsClient } from 'aws4fetch';

const app = new Hono();

app.use('*', cors({
	origin: '*',
	allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'x-limit-type', 'x-limit-value']
}));

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

app.post('/upload', async (c) => {
	const env = c.env;
	const body = await c.req.arrayBuffer();
	const limitType = c.req.header('x-limit-type') || 'clicks';
	const limitValue = parseInt(c.req.header('x-limit-value') || '1', 10);

	const token = Math.random().toString(36).substring(2, 8);
	const fileId = crypto.randomUUID();

	const aws = new AwsClient({
		accessKeyId: env.B2_KEY_ID,
		secretAccessKey: env.B2_APPLICATION_KEY,
		service: 's3',
		region: env.B2_REGION
	});

	await aws.fetch(`${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/${fileId}`, {
		method: 'PUT',
		body: body
	});

	const redisPayload = { fileId, limitType, value: limitValue };
	const ttl = limitType === 'time' ? limitValue : 604800;

	await fetch(env.UPSTASH_URL, {
		method: 'POST',
		headers: { Authorization: `Bearer ${env.UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(['SET', token, JSON.stringify(redisPayload), 'EX', ttl])
	});

	return c.json({ success: true, token });
});

app.get('/download/:token', async (c) => {
	const env = c.env;
	const token = c.req.param('token');

	const redisRes = await fetch(env.UPSTASH_URL, {
		method: 'POST',
		headers: { Authorization: `Bearer ${env.UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(['GET', token])
	});
	const redisData = await redisRes.json();

	if (!redisData.result) {
		return c.text('File not found or expired', 404);
	}

	const config = JSON.parse(redisData.result);

	const aws = new AwsClient({
		accessKeyId: env.B2_KEY_ID,
		secretAccessKey: env.B2_APPLICATION_KEY,
		service: 's3',
		region: env.B2_REGION
	});

	const b2Res = await aws.fetch(`${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/${config.fileId}`);
	if (!b2Res.ok) {
		return c.text('File storage error', 404);
	}

	const fileBlob = await b2Res.arrayBuffer();

	if (config.limitType === 'clicks') {
		config.value = config.value - 1;
		if (config.value <= 0) {
			await fetch(env.UPSTASH_URL, {
				method: 'POST',
				headers: { Authorization: `Bearer ${env.UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(['DEL', token])
			});
			await aws.fetch(`${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/${config.fileId}`, {
				method: 'DELETE'
			});
		} else {
			await fetch(env.UPSTASH_URL, {
				method: 'POST',
				headers: { Authorization: `Bearer ${env.UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(['SET', token, JSON.stringify(config), 'EX', 604800])
			});
		}
	}

	return c.body(fileBlob, 200, {
		'Content-Type': 'application/octet-stream',
		'Access-Control-Allow-Origin': '*'
	});
});

export default app;
