import { sendPushNotifications } from '../../server/pushNotifications.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await sendPushNotifications(req.body || {});
  return res.status(result.status).json(result.body);
}
