import { json } from '@tanstack/react-start'
import { createAPIFileRoute } from '@tanstack/react-start/api'

export const APIRoute = createAPIFileRoute('/api/up')({
  GET: async () => {
    return json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    })
  },
})
