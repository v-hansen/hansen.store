import type { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'isomorphic-unfetch'

import storeConfig from 'store.config'

const SITEMAP_URL = `https://${storeConfig.api.storeId}.myvtex.com`
const FRONTEND_URL = storeConfig.storeUrl

const HOSTNAME_REGEX = new RegExp(SITEMAP_URL, 'g')

function replace(string: string, regex: RegExp, replacement: string): string {
  return string.replace(regex, replacement)
}

export default async function proxy(req: NextApiRequest, res: NextApiResponse) {
  let content: string
  let contentType: string | null

  const upstreamRes = await fetch(`${SITEMAP_URL}${req.url}`, {
    redirect: 'manual',
  })

  if (upstreamRes.status > 300 && upstreamRes.status < 310) {
    const location = upstreamRes.headers.get('location')

    if (location) {
      const locationURL = new URL(location, upstreamRes.url)

      if (locationURL.href.includes(SITEMAP_URL)) {
        const response2 = await fetch(locationURL, {
          redirect: 'manual',
        })

        content = await response2.text()
        contentType = response2.headers.get('content-type')
      } else {
        throw new Error(
          `abort proxy to non-wordpress target ${locationURL.href} to avoid redirect loops`
        )
      }
    } else {
      throw new Error('Location header not found')
    }
  } else {
    content = await upstreamRes.text()
    contentType = upstreamRes.headers.get('content-type')
  }

  if (req.url?.includes('sitemap')) {
    content = replace(content, HOSTNAME_REGEX, FRONTEND_URL)
    const sitemapFind = '//(.*)main-sitemap.xml'
    const sitemapReplace = '/sitemap-template.xml'
    const SITEMAP_XSL_REGEX = new RegExp(sitemapFind, 'g')

    content = replace(content, SITEMAP_XSL_REGEX, sitemapReplace)
  }

  if (req.url?.includes('XMLData')) {
    content = replace(content, HOSTNAME_REGEX, FRONTEND_URL)
    const sitemapFind = '/XMLData/(.*).xml'
    const sitemapReplace = '/xmldata.xml'
    const SITEMAP_XSL_REGEX = new RegExp(sitemapFind, 'g')

    content = replace(content, SITEMAP_XSL_REGEX, sitemapReplace)
  }

  if (contentType) {
    res.setHeader('Content-Type', contentType)
  }

  res.send(content)
}
