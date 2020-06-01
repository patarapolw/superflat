import axios from 'axios'

export interface IMetadata {
  description?: string
  icon: string
  image?: string
  keywords?: string[]
  title?: string
  language?: string
  type?: string
  url: string
  provider: string
}

export async function getMetadata(url: string): Promise<IMetadata> {
  return await fetch(`/api/metadata?url=${encodeURIComponent(url)}`).then((r) =>
    r.json()
  )
}
