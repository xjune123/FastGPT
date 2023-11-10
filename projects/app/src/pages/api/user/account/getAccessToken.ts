// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@/service/response';
import { generateToken } from '@fastgpt/service/support/user/auth';
import { setCookie } from '@fastgpt/service/support/user/auth';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { constant } from 'lodash';
import { hashStr } from '@fastgpt/global/common/string/tools';
import { PRICE_SCALE } from '@fastgpt/global/common/bill/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { code } = req.body;
    const authCodeCheckUrl = `${tokenInfo.base_url}/oauth/oauth/token?client_id=${tokenInfo.client_id}&client_secret=${tokenInfo.client_secret}&grant_type=${tokenInfo.grant_type}&code=${code}&redirect_uri=http://localhost:3000/chat_new1/share?shareId=3mnm58stef6ztuiss5ieylp1`;
    const response = await fetch(authCodeCheckUrl, {
      method: 'POST'
    }).then((res) => res.json());
    if (response.status === 401) {
      jsonRes(res, {
        code: 401,
        error: 'Unauthorized'
      });
    }
    if (response.status === 400) {
      jsonRes(res, {
        code: 400,
        error: 'Invalid authorization code'
      });
    }

    console.log(response);

    //TODO 解决报错用户名不存问题

    const userInfoUrl = `${tokenInfo.base_url}/iam/hzero/v1/users/self?client_id=${tokenInfo.client_id}`;
    const userInfoResponse = await fetch(userInfoUrl, {
      method: 'GET',
      headers: { Authorization: `bearer ${response.access_token}` }
    }).then((useInfoRes) => useInfoRes.json());
    let authUser;
    if (!userInfoResponse.status) {
      authUser = await MongoUser.findOne({
        username: userInfoResponse.phone
      });
    } else {
      jsonRes(res, {
        code: 401,
        error: 'Unauthorized'
      });
    }

    if (!authUser) {
      const psw = process.env.DEFAULT_ROOT_PSW || '123456';
      authUser = await MongoUser.create({
        username: userInfoResponse.phone,
        password: hashStr(psw),
        balance: 999999 * PRICE_SCALE
      });
    }
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
