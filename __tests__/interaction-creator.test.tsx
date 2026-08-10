// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { useState } from 'react'

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import InteractionCreator from '@/components/InteractionCreator/InteractionCreator'
import type { HeroInteraction } from '@/lib/custom-hero-types'

afterEach(() => {
  cleanup()
})

function InteractionHarness({ initialInteractions = [] }: { initialInteractions?: HeroInteraction[] }) {
  const [interactions, setInteractions] = useState(initialInteractions)

  return (
    <>
      <InteractionCreator
        customHeroId="custom-hero-1"
        customHeroName="Aurora"
        customHeroPortrait="/panorama/images/heroes/abrams.png"
        accentColor="#72d6ff"
        interactions={interactions}
        onChange={setInteractions}
      />
      <output data-testid="interaction-state">{JSON.stringify(interactions)}</output>
    </>
  )
}

function readInteractions() {
  return JSON.parse(screen.getByTestId('interaction-state').textContent ?? '[]') as HeroInteraction[]
}

describe('InteractionCreator', () => {
  it('uses the existing editor background and offsets the workspace beside the persistent editor pane', () => {
    const stylesheet = readFileSync('components/InteractionCreator/InteractionCreator.module.css', 'utf8')
    const creatorRule = stylesheet.match(/\.creator\s*\{([^}]*)\}/)?.[1] ?? ''
    const collapsedRule = stylesheet.match(/\.creatorPaneCollapsed\s*\{([^}]*)\}/)?.[1] ?? ''
    const voicelineRule = stylesheet.match(/\.voicelineInput\s*\{([^}]*)\}/)?.[1] ?? ''
    const rightLineRowRule = stylesheet.match(/\.rightLine \.lineRow\s*\{([^}]*)\}/)?.[1] ?? ''
    const avatarRule = stylesheet.match(/\.lineAvatar\s*\{([^}]*)\}/)?.[1] ?? ''
    const dialogueListRule = stylesheet.match(/\.dialogueList\s*\{([^}]*)\}/)?.[1] ?? ''
    const lineActionsRule = stylesheet.match(/\.lineActions\s*\{([^}]*)\}/)?.[1] ?? ''
    const emptyDialogueRule = stylesheet.match(/\.emptyDialogue\s*\{([^}]*)\}/)?.[1] ?? ''
    const startLineButtonRule = stylesheet.match(/\.startLineButton\s*\{([^}]*)\}/)?.[1] ?? ''
    const startLineAvatarRule = stylesheet.match(/\.startLineAvatar,\s*\.lineAvatar\s*\{([^}]*)\}/)?.[1] ?? ''
    const viewerRule = stylesheet.match(/\.creatorViewer\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(creatorRule).toMatch(/top:\s*52px/)
    expect(creatorRule).toMatch(/left:\s*clamp\(360px,\s*32vw,\s*410px\)/)
    expect(creatorRule).toMatch(/rgba\(12,\s*16,\s*20,\s*0\.34\)/)
    expect(creatorRule).not.toMatch(/rgba\([^)]*,\s*0\.9[7-9]\)/)
    expect(collapsedRule).toMatch(/left:\s*54px/)
    expect(stylesheet).not.toContain('.actorCard')
    expect(stylesheet).not.toContain('rgb(239, 226, 26)')
    expect(voicelineRule).toMatch(/background:\s*color-mix\(in srgb,\s*var\(--interaction-accent\)\s*86%,\s*#ffefd6\)/)
    expect(voicelineRule).toMatch(/field-sizing:\s*content/)
    expect(voicelineRule).toMatch(/min-width:\s*7ch/)
    expect(voicelineRule).toMatch(/resize:\s*none/)
    expect(rightLineRowRule).toMatch(/justify-content:\s*flex-end/)
    expect(avatarRule).not.toMatch(/border:/)
    expect(avatarRule).not.toMatch(/background-color:/)
    expect(dialogueListRule).toMatch(/gap:\s*8px/)
    expect(lineActionsRule).toMatch(/position:\s*absolute/)
    expect(lineActionsRule).toMatch(/opacity:\s*0/)
    expect(emptyDialogueRule).toMatch(/justify-content:\s*space-between/)
    expect(startLineButtonRule).toMatch(/background:\s*transparent/)
    expect(startLineAvatarRule).toMatch(/width:\s*58px/)
    expect(startLineAvatarRule).not.toMatch(/border:/)
    expect(viewerRule).toMatch(/position:\s*relative/)
    expect(viewerRule).toMatch(/inset:\s*auto/)
    expect(viewerRule).toMatch(/height:\s*min\(84vh,\s*820px\)/)
    expect(viewerRule).toMatch(/background:\s*#0b0e11/)
    expect(viewerRule).toMatch(/border:\s*1px solid/)
    expect(stylesheet).not.toContain('.initiatorPrompt')
    expect(stylesheet).not.toContain('.initiatorChoice')
  })

  it('starts from either edge of the conversation canvas and creates alternating compact speaker rows', async () => {
    const user = userEvent.setup()

    render(<InteractionHarness />)

    await user.click(screen.getByRole('button', { name: /new conversation/i }))
    const targetDialog = screen.getByRole('dialog', { name: /choose target hero/i })
    const apolloOption = within(targetDialog).getByRole('button', { name: 'Apollo' })

    expect(apolloOption.querySelector('img')).toHaveAttribute('src', expect.stringContaining('fencer_sm_psd.png'))

    await user.click(apolloOption)

    const leftStartButton = screen.getByRole('button', { name: 'Start with Aurora' })
    const rightStartButton = screen.getByRole('button', { name: 'Start with Apollo' })

    expect(leftStartButton).toHaveAttribute('title', 'Start with Aurora')
    expect(rightStartButton).toHaveAttribute('title', 'Start with Apollo')
    expect(leftStartButton.childElementCount).toBe(2)
    expect(rightStartButton.childElementCount).toBe(2)
    expect(leftStartButton.querySelector('svg')).not.toBeNull()
    expect(rightStartButton.querySelector('svg')).not.toBeNull()
    expect(within(leftStartButton).getByRole('img', { name: 'Aurora portrait' })).toBeInTheDocument()
    expect(within(rightStartButton).getByRole('img', { name: 'Apollo portrait' })).toHaveAttribute(
      'src',
      expect.stringContaining('fencer_sm_psd.png'),
    )
    expect(screen.queryByText(/choose the first speaker/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/who speaks first/i)).not.toBeInTheDocument()

    await user.click(leftStartButton)

    const firstEditor = screen.getByRole('textbox', { name: 'Aurora voiceline 1' })
    await user.type(firstEditor, 'How about you give me the same respect?')
    const firstLine = firstEditor.closest('li')

    expect(firstEditor).toHaveValue('How about you give me the same respect?')
    expect(firstEditor).toHaveAttribute('rows', '1')
    expect(firstLine).not.toBeNull()
    expect(within(firstLine as HTMLElement).getByText('Aurora')).toBeInTheDocument()
    expect(within(firstLine as HTMLElement).getByRole('img', { name: 'Aurora portrait' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /tone/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add apollo line/i }))

    const secondEditor = screen.getByRole('textbox', { name: 'Apollo voiceline 2' })
    const secondLine = secondEditor.closest('li')

    expect(secondLine).not.toBeNull()
    expect(within(secondLine as HTMLElement).getByText('Apollo')).toBeInTheDocument()
    expect(secondLine?.querySelector('img')).toHaveAttribute('src', expect.stringContaining('fencer_sm_psd.png'))

    const interactions = readInteractions()
    expect(interactions[0].targetHeroId).toBe('apollo')
    expect(interactions[0].lines[0].text).toBe('How about you give me the same respect?')
    expect(interactions[0].lines.map(line => [line.speakerSide, line.speakerHeroId, line.order])).toEqual([
      ['left', 'custom-hero-1', 0],
      ['right', 'apollo', 1],
    ])
  })

  it('uses the right-side plus to start with the target hero', async () => {
    const user = userEvent.setup()

    render(<InteractionHarness />)

    await user.click(screen.getByRole('button', { name: /new conversation/i }))
    const targetDialog = screen.getByRole('dialog', { name: /choose target hero/i })

    await user.click(within(targetDialog).getByRole('button', { name: 'Apollo' }))
    await user.click(screen.getByRole('button', { name: 'Start with Apollo' }))

    expect(screen.getByRole('textbox', { name: 'Apollo voiceline 1' })).toBeInTheDocument()
    expect(readInteractions()[0].lines[0]).toMatchObject({
      speakerSide: 'right',
      speakerHeroId: 'apollo',
      order: 0,
    })
  })

  it('renames, duplicates, filters, and deletes conversations', async () => {
    const user = userEvent.setup()
    const interaction: HeroInteraction = {
      id: 'interaction-1',
      targetHeroId: 'bebop',
      targetHeroName: 'Bebop',
      title: 'Lane Partner Banter',
      lines: [],
      createdAt: '2026-07-20T12:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z',
    }

    render(<InteractionHarness initialInteractions={[interaction]} />)

    await user.click(screen.getByRole('button', { name: /conversations/i }))
    await user.click(screen.getByRole('button', { name: 'Rename Lane Partner Banter' }))

    const renameInput = screen.getByRole('textbox', { name: 'Rename Lane Partner Banter' })
    await user.clear(renameInput)
    await user.type(renameInput, 'Friendly Lane Banter')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(readInteractions()[0].title).toBe('Friendly Lane Banter')

    await user.click(screen.getByRole('button', { name: 'Duplicate Friendly Lane Banter' }))
    expect(readInteractions()).toHaveLength(2)
    expect(readInteractions()[1].title).toBe('Friendly Lane Banter Copy')

    await user.click(screen.getByRole('button', { name: /conversations/i }))
    const filterInput = screen.getByRole('textbox', { name: /search conversations/i })
    fireEvent.change(filterInput, { target: { value: 'copy' } })
    const conversationDialog = screen.getByRole('dialog', { name: 'Conversations' })

    expect(within(conversationDialog).getByText('Friendly Lane Banter Copy')).toBeInTheDocument()
    expect(within(conversationDialog).queryByText('Friendly Lane Banter')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Friendly Lane Banter Copy' }))
    expect(readInteractions()).toHaveLength(1)
  })
})
