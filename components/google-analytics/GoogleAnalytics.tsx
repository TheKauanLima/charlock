import Script from 'next/script'

import {
  getGoogleAnalyticsMeasurementId,
  shouldEnableGoogleAnalytics,
} from '@/lib/google-analytics'

export default function GoogleAnalytics() {
  if (!shouldEnableGoogleAnalytics()) {
    return null
  }

  const measurementId = getGoogleAnalyticsMeasurementId()

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', ${JSON.stringify(measurementId)});
        `}
      </Script>
    </>
  )
}
