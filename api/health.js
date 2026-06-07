import { handleHealth } from '../../server/syncApi.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const result = handleHealth()
  return res.status(result.status).json(result.body)
}
