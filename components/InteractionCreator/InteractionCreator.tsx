'use client'

import Image from 'next/image'
import { ArrowDown, ArrowUp, Copy, MessageSquareText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { DialogueLine, DialogueSpeakerSide, HeroInteraction } from '@/lib/custom-hero-types'
import { getInteractionTargetHero, INTERACTION_ROSTER_HEROES, type InteractionRosterHero } from '@/lib/interaction-heroes'
import cn from '@/lib/utilsd'

import styles from './InteractionCreator.module.css'

interface InteractionCreatorProps {
  customHeroId: string
  customHeroName: string
  customHeroPortrait: string
  accentColor: string
  interactions: HeroInteraction[]
  customTargetHeroes?: InteractionRosterHero[]
  editorPaneCollapsed?: boolean
  readOnly?: boolean
  onClose?: () => void
  onChange: (interactions: HeroInteraction[]) => void
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getSpeakerHeroId(side: DialogueSpeakerSide, customHeroId: string, targetHeroId: string) {
  return side === 'left' ? customHeroId : targetHeroId
}

function getOppositeSide(side: DialogueSpeakerSide): DialogueSpeakerSide {
  return side === 'left' ? 'right' : 'left'
}

function resequenceLines(
  lines: DialogueLine[],
  customHeroId: string,
  targetHeroId: string,
  firstSide: DialogueSpeakerSide = lines[0]?.speakerSide ?? 'left',
) {
  return lines.map((line, order) => {
    const speakerSide = order % 2 === 0 ? firstSide : getOppositeSide(firstSide)

    return {
      ...line,
      order,
      speakerSide,
      speakerHeroId: getSpeakerHeroId(speakerSide, customHeroId, targetHeroId),
    }
  })
}

function formatEditedDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Recently edited'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function compareInteractionsByCharacter(left: HeroInteraction, right: HeroInteraction) {
  const characterComparison = left.targetHeroName.localeCompare(right.targetHeroName, undefined, { sensitivity: 'base' })

  return characterComparison || left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
}

export default function InteractionCreator({
  customHeroId,
  customHeroName,
  customHeroPortrait,
  accentColor,
  interactions,
  customTargetHeroes = [],
  editorPaneCollapsed = false,
  readOnly = false,
  onClose,
  onChange,
}: InteractionCreatorProps) {
  const orderedInteractions = useMemo(
    () => readOnly ? interactions.slice().sort(compareInteractionsByCharacter) : interactions,
    [interactions, readOnly],
  )
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(orderedInteractions[0]?.id ?? null)
  const [isTargetPickerOpen, setIsTargetPickerOpen] = useState(false)
  const [isConversationPickerOpen, setIsConversationPickerOpen] = useState(false)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [conversationSearch, setConversationSearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')
  const [renamingInteractionId, setRenamingInteractionId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const activeInteraction = orderedInteractions.find(interaction => interaction.id === activeInteractionId) ?? orderedInteractions[0] ?? null
  const activeInteractionLines = activeInteraction
    ? readOnly
      ? activeInteraction.lines.slice().sort((left, right) => left.order - right.order)
      : activeInteraction.lines
    : []
  const availableTargetHeroes = useMemo(
    () => [...INTERACTION_ROSTER_HEROES, ...customTargetHeroes],
    [customTargetHeroes],
  )
  const targetHero = activeInteraction ? getInteractionTargetHero(activeInteraction, customTargetHeroes) : null
  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase()

    if (!query) return interactions

    return interactions.filter(interaction =>
      interaction.title.toLowerCase().includes(query)
      || interaction.targetHeroName.toLowerCase().includes(query),
    )
  }, [conversationSearch, interactions])
  const filteredTargets = useMemo(() => {
    const query = targetSearch.trim().toLowerCase()

    if (!query) return availableTargetHeroes

    return availableTargetHeroes.filter(hero => hero.name.toLowerCase().includes(query))
  }, [availableTargetHeroes, targetSearch])

  useEffect(() => {
    if (!readOnly || !onClose) return undefined

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, readOnly])

  function replaceInteraction(interactionId: string, update: (interaction: HeroInteraction) => HeroInteraction) {
    const updatedAt = new Date().toISOString()

    onChange(interactions.map(interaction =>
      interaction.id === interactionId
        ? { ...update(interaction), updatedAt }
        : interaction,
    ))
  }

  function openTargetPicker(forNewConversation: boolean) {
    setIsCreatingConversation(forNewConversation)
    setTargetSearch('')
    setIsTargetPickerOpen(true)
  }

  function chooseTarget(hero: InteractionRosterHero) {
    if (isCreatingConversation || !activeInteraction) {
      const timestamp = new Date().toISOString()
      const interaction: HeroInteraction = {
        id: createId('interaction'),
        targetHeroId: hero.id,
        targetHeroName: hero.name,
        targetHeroPortrait: hero.isCustom ? hero.portrait : undefined,
        title: `Conversation with ${hero.name}`,
        lines: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      onChange([...interactions, interaction])
      setActiveInteractionId(interaction.id)
    } else {
      replaceInteraction(activeInteraction.id, interaction => ({
        ...interaction,
        targetHeroId: hero.id,
        targetHeroName: hero.name,
        targetHeroPortrait: hero.isCustom ? hero.portrait : undefined,
        title: interaction.title === `Conversation with ${interaction.targetHeroName}`
          ? `Conversation with ${hero.name}`
          : interaction.title,
        lines: resequenceLines(interaction.lines, customHeroId, hero.id),
      }))
    }

    setIsCreatingConversation(false)
    setIsTargetPickerOpen(false)
  }

  function addLine(side?: DialogueSpeakerSide) {
    if (!activeInteraction) return

    const speakerSide = side
      ?? (activeInteraction.lines.length
        ? getOppositeSide(activeInteraction.lines[activeInteraction.lines.length - 1].speakerSide)
        : 'left')
    const line: DialogueLine = {
      id: createId('line'),
      speakerSide,
      speakerHeroId: getSpeakerHeroId(speakerSide, customHeroId, activeInteraction.targetHeroId),
      text: '',
      order: activeInteraction.lines.length,
    }

    replaceInteraction(activeInteraction.id, interaction => ({
      ...interaction,
      lines: [...interaction.lines, line],
    }))
  }

  function updateLine(lineId: string, update: Partial<DialogueLine>) {
    if (!activeInteraction) return

    replaceInteraction(activeInteraction.id, interaction => ({
      ...interaction,
      lines: interaction.lines.map(line => line.id === lineId ? { ...line, ...update } : line),
    }))
  }

  function deleteLine(lineId: string) {
    if (!activeInteraction) return

    replaceInteraction(activeInteraction.id, interaction => {
      const remainingLines = interaction.lines.filter(line => line.id !== lineId)

      return {
        ...interaction,
        lines: resequenceLines(
          remainingLines,
          customHeroId,
          interaction.targetHeroId,
          remainingLines[0]?.speakerSide,
        ),
      }
    })
  }

  function moveLine(lineId: string, direction: -1 | 1) {
    if (!activeInteraction) return

    replaceInteraction(activeInteraction.id, interaction => {
      const currentIndex = interaction.lines.findIndex(line => line.id === lineId)
      const nextIndex = currentIndex + direction

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= interaction.lines.length) return interaction

      const nextLines = interaction.lines.slice()
      const [line] = nextLines.splice(currentIndex, 1)

      nextLines.splice(nextIndex, 0, line)

      return {
        ...interaction,
        lines: resequenceLines(nextLines, customHeroId, interaction.targetHeroId, nextLines[0]?.speakerSide),
      }
    })
  }

  function duplicateInteraction(interaction: HeroInteraction) {
    const timestamp = new Date().toISOString()
    const duplicate: HeroInteraction = {
      ...interaction,
      id: createId('interaction'),
      title: `${interaction.title} Copy`.slice(0, 100),
      lines: interaction.lines.map(line => ({ ...line, id: createId('line') })),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    onChange([...interactions, duplicate])
    setActiveInteractionId(duplicate.id)
    setIsConversationPickerOpen(false)
  }

  function deleteInteraction(interactionId: string) {
    const nextInteractions = interactions.filter(interaction => interaction.id !== interactionId)

    onChange(nextInteractions)
    setActiveInteractionId(current => current === interactionId ? nextInteractions[0]?.id ?? null : current)
    setRenamingInteractionId(null)
  }

  function beginRename(interaction: HeroInteraction) {
    setRenamingInteractionId(interaction.id)
    setRenameValue(interaction.title)
  }

  function commitRename(interactionId: string) {
    const title = renameValue.trim()

    if (!title) return

    replaceInteraction(interactionId, interaction => ({ ...interaction, title }))
    setRenamingInteractionId(null)
  }

  function renderCustomHeroThumbnail(className: string) {
    return (
      <span
        className={className}
        role="img"
        aria-label={`${customHeroName} portrait`}
        style={{ backgroundImage: `url('${customHeroPortrait}')` }}
      />
    )
  }

  return (
    <section
      className={cn(styles.creator, editorPaneCollapsed && styles.creatorPaneCollapsed, readOnly && styles.creatorViewer)}
      data-interaction-creator="true"
      data-testid="interaction-creator"
      data-read-only={readOnly ? 'true' : undefined}
      role={readOnly ? 'dialog' : undefined}
      aria-modal={readOnly ? true : undefined}
      aria-label={readOnly ? `${customHeroName} Interactions` : 'Interaction creator'}
      style={{ '--interaction-accent': accentColor } as React.CSSProperties}
    >
      <header className={styles.stageHeader}>
        <div>
          <p className={styles.eyebrow}>{readOnly ? 'Character Interactions' : 'Interaction Creator'}</p>
          <h1>{activeInteraction?.title ?? 'Create a character interaction'}</h1>
          <p className={styles.stageDescription}>
            {activeInteraction
              ? `${activeInteractionLines.length} ${activeInteractionLines.length === 1 ? 'line' : 'lines'} · ${activeInteraction.targetHeroName}`
              : 'Choose an official hero or one of your own heroes to begin a new conversation.'}
          </p>
        </div>
        <div className={styles.headerActions}>
          {readOnly ? (
            <button type="button" autoFocus className={styles.iconButton} aria-label="Close interaction viewer" onClick={onClose}>
              <X aria-hidden="true" />
            </button>
          ) : (
            <>
              {activeInteraction ? (
                <button type="button" className={styles.secondaryButton} onClick={() => openTargetPicker(false)}>
                  Change target
                </button>
              ) : null}
              <button type="button" className={styles.secondaryButton} onClick={() => setIsConversationPickerOpen(true)}>
                <MessageSquareText aria-hidden="true" />
                Conversations
                <span>{interactions.length}</span>
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => openTargetPicker(true)}>
                <Plus aria-hidden="true" />
                New conversation
              </button>
            </>
          )}
        </div>
      </header>

      <div className={cn(styles.stageBody, readOnly && styles.viewerStageBody)}>
        {readOnly ? (
          <aside className={cn(styles.conversationList, styles.viewerConversationRail)} aria-label="Interactions ordered by character">
            {orderedInteractions.length ? orderedInteractions.map(interaction => {
              const rosterHero = getInteractionTargetHero(interaction, customTargetHeroes)

              return (
                <article key={interaction.id} className={cn(styles.conversationItem, interaction.id === activeInteraction?.id && styles.activeConversationItem)}>
                  <button
                    type="button"
                    className={styles.conversationSelect}
                    aria-label={`View ${interaction.targetHeroName} interaction: ${interaction.title}`}
                    aria-pressed={interaction.id === activeInteraction?.id}
                    onClick={() => setActiveInteractionId(interaction.id)}
                  >
                    {rosterHero ? <Image src={rosterHero.smallPortrait} alt="" width={64} height={64} sizes="64px" /> : null}
                    <span>
                      <strong>{interaction.targetHeroName}</strong>
                      <small>{interaction.title} · {interaction.lines.length} {interaction.lines.length === 1 ? 'line' : 'lines'}</small>
                    </span>
                  </button>
                </article>
              )
            }) : <p className={styles.emptyList}>No published interactions.</p>}
          </aside>
        ) : null}
        <main className={styles.dialogueCanvas}>
          {!activeInteraction ? (
            readOnly ? (
              <div className={cn(styles.emptyConversation, styles.readOnlyEmptyConversation)}>
                <MessageSquareText aria-hidden="true" />
                <strong>No published interactions</strong>
                <span>{customHeroName} does not have any conversations yet.</span>
              </div>
            ) : (
              <button type="button" className={styles.emptyConversation} onClick={() => openTargetPicker(true)}>
                <MessageSquareText aria-hidden="true" />
                <strong>Choose a target hero</strong>
                <span>Create the first conversation for {customHeroName}.</span>
              </button>
            )
          ) : activeInteractionLines.length === 0 ? (
            readOnly ? (
              <div className={cn(styles.emptyConversation, styles.readOnlyEmptyConversation)}>
                <MessageSquareText aria-hidden="true" />
                <strong>No dialogue lines</strong>
                <span>This conversation is currently empty.</span>
              </div>
            ) : (
              <div className={styles.emptyDialogue} aria-label="Add the first dialogue line">
                <button
                  type="button"
                  className={styles.startLineButton}
                  onClick={() => addLine('left')}
                  aria-label={`Start with ${customHeroName}`}
                  title={`Start with ${customHeroName}`}
                >
                  {renderCustomHeroThumbnail(styles.startLineAvatar)}
                  <span className={styles.startLinePlus}>
                    <Plus aria-hidden="true" />
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.startLineButton}
                  onClick={() => addLine('right')}
                  aria-label={`Start with ${activeInteraction.targetHeroName}`}
                  title={`Start with ${activeInteraction.targetHeroName}`}
                >
                  <span className={styles.startLinePlus}>
                    <Plus aria-hidden="true" />
                  </span>
                  {targetHero ? (
                    <Image
                      className={styles.startLineAvatar}
                      src={targetHero.smallPortrait}
                      alt={`${activeInteraction.targetHeroName} portrait`}
                      width={58}
                      height={58}
                      sizes="58px"
                    />
                  ) : null}
                </button>
              </div>
            )
          ) : (
            <ol className={styles.dialogueList} aria-label={`${activeInteraction.title} dialogue`}>
              {activeInteractionLines.map((line, index) => {
                const isLeft = line.speakerSide === 'left'
                const speakerName = isLeft ? customHeroName : activeInteraction.targetHeroName

                return (
                  <li key={line.id} className={cn(styles.dialogueLine, isLeft ? styles.leftLine : styles.rightLine)}>
                    <div className={styles.lineRow}>
                      {isLeft ? renderCustomHeroThumbnail(styles.lineAvatar) : null}
                      <div className={styles.lineBody}>
                        <div className={styles.speakerName}>
                          <span style={{ fontFamily: 'var(--font-character-name)' }}>{speakerName}</span>
                        </div>
                        <textarea
                          className={styles.voicelineInput}
                          aria-label={`${speakerName} voiceline ${index + 1}`}
                          value={line.text}
                          maxLength={500}
                          rows={1}
                          placeholder={`What does ${speakerName} say?`}
                          readOnly={readOnly}
                          onChange={readOnly ? undefined : event => updateLine(line.id, { text: event.target.value })}
                        />
                        {!readOnly ? (
                          <div className={styles.lineActions} aria-label={`Line ${index + 1} actions`}>
                            <button type="button" aria-label={`Move line ${index + 1} up`} disabled={index === 0} onClick={() => moveLine(line.id, -1)}>
                              <ArrowUp aria-hidden="true" />
                            </button>
                            <button type="button" aria-label={`Move line ${index + 1} down`} disabled={index === activeInteractionLines.length - 1} onClick={() => moveLine(line.id, 1)}>
                              <ArrowDown aria-hidden="true" />
                            </button>
                            <button type="button" aria-label={`Delete line ${index + 1}`} onClick={() => deleteLine(line.id)}>
                              <Trash2 aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {!isLeft && targetHero ? (
                        <Image className={styles.lineAvatar} src={targetHero.smallPortrait} alt="" width={58} height={58} sizes="58px" />
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {!readOnly && activeInteraction && activeInteractionLines.length > 0 ? (
            <button type="button" className={styles.addLineButton} onClick={() => addLine()}>
              <Plus aria-hidden="true" />
              Add {getOppositeSide(activeInteractionLines[activeInteractionLines.length - 1].speakerSide) === 'left' ? customHeroName : activeInteraction.targetHeroName} line
            </button>
          ) : null}
        </main>
      </div>

      {isTargetPickerOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="target-hero-picker-title">
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Characters</p>
                <h2 id="target-hero-picker-title">Choose Target Hero</h2>
              </div>
              <button type="button" className={styles.iconButton} aria-label="Close target hero selector" onClick={() => setIsTargetPickerOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </header>
            <label className={styles.searchField}>
              <Search aria-hidden="true" />
              <span className="sr-only">Search official and custom heroes</span>
              <input value={targetSearch} placeholder="Search heroes" onChange={event => setTargetSearch(event.target.value)} />
            </label>
            <div className={styles.targetGrid}>
              {filteredTargets.map(hero => (
                <button
                  key={hero.id}
                  type="button"
                  className={styles.targetOption}
                  aria-label={hero.isCustom ? `${hero.name} (Your hero)` : hero.name}
                  onClick={() => chooseTarget(hero)}
                >
                  <Image src={hero.smallPortrait} alt="" width={120} height={120} sizes="120px" />
                  <span>{hero.name}</span>
                  <small aria-hidden="true">{hero.isCustom ? 'Your hero' : '\u00a0'}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isConversationPickerOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={cn(styles.modal, styles.conversationModal)} role="dialog" aria-modal="true" aria-labelledby="conversation-picker-title">
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Dialogue Library</p>
                <h2 id="conversation-picker-title">Conversations</h2>
              </div>
              <button type="button" className={styles.iconButton} aria-label="Close conversation selector" onClick={() => setIsConversationPickerOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </header>
            <div className={styles.conversationToolbar}>
              <label className={styles.searchField}>
                <Search aria-hidden="true" />
                <span className="sr-only">Search conversations</span>
                <input value={conversationSearch} placeholder="Filter conversations" onChange={event => setConversationSearch(event.target.value)} />
              </label>
              <button type="button" className={styles.primaryButton} onClick={() => {
                setIsConversationPickerOpen(false)
                openTargetPicker(true)
              }}>
                <Plus aria-hidden="true" />
                New
              </button>
            </div>
            <div className={styles.conversationList}>
              {filteredConversations.length ? filteredConversations.map(interaction => {
                const hero = getInteractionTargetHero(interaction, customTargetHeroes)
                const isRenaming = renamingInteractionId === interaction.id

                return (
                  <article key={interaction.id} className={cn(styles.conversationItem, interaction.id === activeInteraction?.id && styles.activeConversationItem)}>
                    <button type="button" className={styles.conversationSelect} onClick={() => {
                      setActiveInteractionId(interaction.id)
                      setIsConversationPickerOpen(false)
                    }}>
                      {hero ? <Image src={hero.smallPortrait} alt="" width={64} height={64} sizes="64px" /> : null}
                      <span>
                        <strong>{interaction.title}</strong>
                        <small>{interaction.targetHeroName} · {interaction.lines.length} {interaction.lines.length === 1 ? 'line' : 'lines'} · {formatEditedDate(interaction.updatedAt)}</small>
                      </span>
                    </button>
                    {isRenaming ? (
                      <div className={styles.renameRow}>
                        <input
                          autoFocus
                          maxLength={100}
                          aria-label={`Rename ${interaction.title}`}
                          value={renameValue}
                          onChange={event => setRenameValue(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') commitRename(interaction.id)
                            if (event.key === 'Escape') setRenamingInteractionId(null)
                          }}
                        />
                        <button type="button" onClick={() => commitRename(interaction.id)}>Save</button>
                      </div>
                    ) : (
                      <div className={styles.conversationActions}>
                        <button type="button" aria-label={`Rename ${interaction.title}`} onClick={() => beginRename(interaction)}>
                          <Pencil aria-hidden="true" />
                        </button>
                        <button type="button" aria-label={`Duplicate ${interaction.title}`} onClick={() => duplicateInteraction(interaction)}>
                          <Copy aria-hidden="true" />
                        </button>
                        <button type="button" aria-label={`Delete ${interaction.title}`} onClick={() => deleteInteraction(interaction.id)}>
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </article>
                )
              }) : <p className={styles.emptyList}>No conversations match this filter.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
