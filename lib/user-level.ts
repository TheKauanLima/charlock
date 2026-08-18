export interface UserLevel {
  label: 'New User' | 'Contributor' | 'Power User' | 'Community Leader'
  tone: 'rookie' | 'investigator' | 'lead' | 'chief'
  nextAt: number | null
  progress: number
}

export function getUserLevel(contributionCount: number): UserLevel {
  if (contributionCount > 50) {
    return {
      label: 'Community Leader',
      tone: 'chief',
      nextAt: null,
      progress: 100,
    }
  }

  if (contributionCount > 20) {
    return {
      label: 'Power User',
      tone: 'lead',
      nextAt: 51,
      progress: Math.min(100, Math.round((contributionCount / 51) * 100)),
    }
  }

  if (contributionCount > 5) {
    return {
      label: 'Contributor',
      tone: 'investigator',
      nextAt: 21,
      progress: Math.min(100, Math.round((contributionCount / 21) * 100)),
    }
  }

  return {
    label: 'New User',
    tone: 'rookie',
    nextAt: 6,
    progress: Math.min(100, Math.round((contributionCount / 6) * 100)),
  }
}
