import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
  return readFileSync(join(root, path), 'utf8')
}

describe('design pass styles', () => {
  it('defines shared Citadel tokens and helper classes globally', () => {
    const globals = readProjectFile('app/globals.css')

    expect(globals).toMatch(/--citadel-gold:\s*#[0-9a-f]{6}/i)
    expect(globals).toContain('--citadel-button-cut')
    expect(globals).toContain('--citadel-container: 1200px')
    expect(globals).toContain('--citadel-editor-container: 1600px')
    expect(globals).toContain('.citadel-page-title')
    expect(globals).toContain('.citadel-button-primary')
    expect(globals).toContain('.citadel-modal-surface')
  })

  it('uses Citadel button and focus language on browse, profile, auth, and editor controls', () => {
    const styledSurfaces = [
      'components/HeroGrid/HeroGrid.module.css',
      'components/UserProfile/UserProfile.module.css',
      'components/UserProfile/ProfileSettings.module.css',
      'components/auth/auth-ui.module.css',
      'components/HeroInfoEditor/HeroInfoEditor.module.css',
    ].map(readProjectFile)

    for (const css of styledSurfaces) {
      expect(css).toContain('var(--citadel-button-cut)')
      expect(css).toContain('var(--citadel-gold)')
    }
  })

  it('keeps modal shells on the shared backdrop and double-outline surface', () => {
    const modalStyles = [
      'components/HeroGrid/HeroGrid.module.css',
      'components/UserProfile/UserProfile.module.css',
      'components/HeroInfoEditor/HeroInfoEditor.module.css',
      'components/EditorAssetModal/EditorAssetModal.module.css',
      'components/CharacterExport/CharacterExportButton.module.css',
      'components/Moderation/ReportDialog.module.css',
      'components/backstory/BackstoryModule.module.css',
    ].map(readProjectFile)

    for (const css of modalStyles) {
      expect(css).toContain('rgba(0, 0, 0, 0.8)')
      expect(css).toContain('var(--citadel-panel-inner-border)')
    }
  })

  it('keeps the home sections in a fixed top bar and uses Valve Occult for the neutral landing title', () => {
    const heroGrid = readProjectFile('components/HeroGrid/HeroGrid.module.css')

    expect(heroGrid).toMatch(/\.tabs\s*\{[\s\S]*position:\s*fixed;[\s\S]*top:\s*0;[\s\S]*border-bottom:/)
    expect(heroGrid).toMatch(/\.landingTitle\s*\{[\s\S]*font-family:\s*"Valve Occult"/)
  })

  it('keeps the primary top bar slim while focused editor chrome can take over the screen', () => {
    const heroGrid = readProjectFile('components/HeroGrid/HeroGrid.module.css')
    const globalNav = readProjectFile('components/GlobalNav/GlobalNav.module.css')
    const abilityEditor = readProjectFile('components/AbilityEditor/AbilityEditor.module.css')
    const tabsRule = heroGrid.match(/\.tabs\s*\{([^}]*)\}/)?.[1] ?? ''
    const contentRule = heroGrid.match(/\.content\s*\{([^}]*)\}/)?.[1] ?? ''
    const globalNavRule = globalNav.match(/\.nav\s*\{([^}]*)\}/)?.[1] ?? ''
    const avatarFrameRule = globalNav.match(/\.avatarFrame\s*\{([^}]*)\}/)?.[1] ?? ''
    const focusShellRule = abilityEditor.match(/\.focusShell\s*\{([^}]*)\}/)?.[1] ?? ''
    const iconBackdropRule = abilityEditor.match(/\.iconBackdrop\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(tabsRule).toMatch(/min-height:\s*52px/)
    expect(tabsRule).toMatch(/z-index:\s*320/)
    expect(contentRule).toMatch(/padding:\s*66px 24px 16px/)
    expect(globalNavRule).toMatch(/z-index:\s*340/)
    expect(avatarFrameRule).toMatch(/width:\s*40px/)
    expect(focusShellRule).toMatch(/z-index:\s*360/)
    expect(abilityEditor).not.toMatch(/\.focusShell:not\(\.focusShellPreview\) \.focusBackdrop/)
    expect(abilityEditor).not.toMatch(/backdrop-filter:\s*blur\(1px\)/)
    expect(iconBackdropRule).toMatch(/z-index:\s*30000/)
  })

  it('uses a full-height tabbed left pane for create editor settings', () => {
    const heroInfoEditor = readProjectFile('components/HeroInfoEditor/HeroInfoEditor.module.css')
    const controlRailRule = heroInfoEditor.match(/\.controlRail\s*\{([^}]*)\}/)?.[1] ?? ''
    const controlTabRailRule = heroInfoEditor.match(/\.controlTabRail\s*\{([^}]*)\}/)?.[1] ?? ''
    const controlRailToggleRule = heroInfoEditor.match(/\.controlRailToggle\s*\{([^}]*)\}/)?.[1] ?? ''
    const controlRailToggleLabelRule = heroInfoEditor.match(/\.controlRailToggle strong\s*\{([^}]*)\}/)?.[1] ?? ''
    const controlPaneRule = heroInfoEditor.match(/^\.controlPane\s*\{([^}]*)\}/m)?.[1] ?? ''
    const collapsedRailRule = heroInfoEditor.match(/\.controlRailCollapsed\s*\{([^}]*)\}/)?.[1] ?? ''
    const collapsedControlPaneRule = heroInfoEditor.match(/\.controlRailCollapsed \.controlPane\s*\{([^}]*)\}/)?.[1] ?? ''
    const collapsedPreviewRule = heroInfoEditor.match(/\.previewStageRailCollapsed\s*\{([^}]*)\}/)?.[1] ?? ''
    const activeAbilityPreviewRule = heroInfoEditor.match(/\.previewStageAbilityEditorActive\s*\{([^}]*)\}/)?.[1] ?? ''
    const hiddenPaneRule = heroInfoEditor.match(/\.controlPaneSection\[hidden\]\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(controlRailRule).toMatch(/top:\s*52px/)
    expect(controlRailRule).toMatch(/bottom:\s*0/)
    expect(controlRailRule).toMatch(/left:\s*0/)
    expect(controlRailRule).toMatch(/grid-template-columns:\s*54px minmax\(0, 356px\)/)
    expect(controlRailRule).toMatch(/overflow:\s*visible/)
    expect(collapsedRailRule).toMatch(/grid-template-columns:\s*54px minmax\(0, 0\)/)
    expect(collapsedRailRule).toMatch(/width:\s*54px/)
    expect(collapsedRailRule).toMatch(/min-width:\s*54px/)
    expect(collapsedRailRule).not.toMatch(/transform:\s*translateX/)
    expect(collapsedControlPaneRule).toMatch(/visibility:\s*hidden/)
    expect(collapsedControlPaneRule).toMatch(/pointer-events:\s*none/)
    expect(controlRailToggleRule).toMatch(/position:\s*absolute/)
    expect(controlRailToggleRule).toMatch(/right:\s*-28px/)
    expect(controlRailToggleRule).toMatch(/overflow:\s*hidden/)
    expect(controlRailToggleRule).toMatch(/writing-mode:\s*horizontal-tb/)
    expect(controlRailToggleLabelRule).toMatch(/white-space:\s*nowrap/)
    expect(controlRailToggleLabelRule).toMatch(/writing-mode:\s*vertical-rl/)
    expect(collapsedPreviewRule).toMatch(/left:\s*clamp\(28px, 21vw, 190px\)/)
    expect(activeAbilityPreviewRule).toMatch(/visibility:\s*hidden/)
    expect(activeAbilityPreviewRule).toMatch(/pointer-events:\s*none/)
    expect(controlTabRailRule).toMatch(/flex-direction:\s*column/)
    expect(controlPaneRule).toMatch(/flex-direction:\s*column/)
    expect(controlPaneRule).toMatch(/overflow:\s*hidden/)
    expect(hiddenPaneRule).toMatch(/display:\s*none/)
  })
})
