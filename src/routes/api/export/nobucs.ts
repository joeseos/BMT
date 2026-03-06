import { json } from '@tanstack/react-start'
import { createAPIFileRoute } from '@tanstack/react-start/api'

// TODO: Implement Nobucs billing system export
// This will generate CSV/structured data for the Nobucs billing system
// from deal lines, matching the format of the "Nobucs Export" Excel sheet

export const APIRoute = createAPIFileRoute('/api/export/nobucs')({
  GET: async ({ request }) => {
    const url = new URL(request.url)
    const dealId = url.searchParams.get('dealId')

    if (!dealId) {
      return json({ error: 'dealId parameter required' }, { status: 400 })
    }

    // TODO: Fetch deal + lines, format for Nobucs
    return json({
      status: 'not_implemented',
      message: 'Nobucs export coming soon',
      dealId,
    })
  },
})
