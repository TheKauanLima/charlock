// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ReportDialog from '@/components/Moderation/ReportDialog'

afterEach(() => cleanup())

describe('ReportDialog', () => {
  it('submits a selected reason and shows the safety confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      report: { moderationStatus: 'flagged' },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))

    render(<ReportDialog endpoint="/api/heroes/hero_1/report" contentLabel="character" />)

    await user.click(screen.getByRole('button', { name: 'Report Content' }))
    await user.click(screen.getByRole('radio', { name: 'Plagiarism' }))
    await user.type(screen.getByPlaceholderText('Add context that may help the moderation review.'), 'Copied description.')
    await user.click(screen.getByRole('button', { name: 'Submit Report' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/heroes/hero_1/report', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ reason: 'Plagiarism', details: 'Copied description.' }),
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('SYSTEM: Content report logged. Thank you for maintaining safety.')
  })
})
