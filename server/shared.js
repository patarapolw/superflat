import path from 'path'

export const FILEPATH =
  process.env.FILEPATH ||
  path.join('out', new Date().toISOString().replace(/[:.]/g, '-'))
