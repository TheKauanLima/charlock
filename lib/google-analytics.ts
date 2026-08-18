const DEFAULT_GOOGLE_ANALYTICS_MEASUREMENT_ID = 'G-DLK5L73G1T'
const GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/

export function getGoogleAnalyticsMeasurementId(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const configuredMeasurementId = environment.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim().toUpperCase()

  if (
    configuredMeasurementId
    && GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN.test(configuredMeasurementId)
  ) {
    return configuredMeasurementId
  }

  return DEFAULT_GOOGLE_ANALYTICS_MEASUREMENT_ID
}

export function shouldEnableGoogleAnalytics(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.NODE_ENV === 'production'
    && environment.VERCEL_ENV !== 'preview'
    && environment.VERCEL_ENV !== 'development'
}
