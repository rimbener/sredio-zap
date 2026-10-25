// `npm run smee`: forwards GitHub webhooks from the smee channel in WEBHOOK_PUBLIC_URL
// (server/.env) to the local receiver. One variable for both GitHub and smee.
import 'dotenv/config';
import SmeeClient from 'smee-client';

const source = process.env.WEBHOOK_PUBLIC_URL;
if (!source) {
  console.error('Set WEBHOOK_PUBLIC_URL in server/.env to your https://smee.io/<channel> URL.');
  process.exit(1);
}

const target = 'http://localhost:3000/webhooks/github';

new SmeeClient({ source, target }).start();
