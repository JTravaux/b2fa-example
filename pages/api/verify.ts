// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  if (!req.body.signature) {
    res.status(400).json({ error: 'No signature' })
    return
  }

  if (!req.body.message) {
    res.status(400).json({ error: 'No message' })
    return
  }

  // decode signature
  const result = ethers.utils.verifyMessage(
    req.body.message,
    req.body.signature
  )

  res.status(200).json({ address: result })
}

export default handler
