import { handleSyncCustomerCount } from '../../server/syncApi.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const result = await handleSyncCustomerCount()
  return res.status(result.status).json(result.body)
}
