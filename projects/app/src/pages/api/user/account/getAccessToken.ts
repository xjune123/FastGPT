// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@/service/response';
import { generateToken } from '@fastgpt/service/support/user/auth';
import { setCookie } from '@fastgpt/service/support/user/auth';
import { MongoUser } from '@fastgpt/service/support/user/schema';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await fetch('https://pkdc.pooksh.com:8080/oauth/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        ...req.body,
        client_id: 'pk-fastgpt',
        client_secret: 'Pooksh888',
        grant_type: 'authorization_code'
      })
    });
    const authUser = await MongoUser.findOne({
      username: 'root'
    });
    if (authUser) {
      const token = generateToken(authUser._id);
      setCookie(res, token);

      jsonRes(res, {
        data: {
          token
        }
      });
    }
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
