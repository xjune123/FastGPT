// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@/service/response';
import { generateToken } from '@fastgpt/service/support/user/auth';
import { setCookie } from '@fastgpt/service/support/user/auth';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { hashStr } from '@fastgpt/global/common/string/tools';
import { PRICE_SCALE } from '@fastgpt/global/common/bill/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { code, redirect_uri } = req.body;

    const form = new URLSearchParams();
    form.append('grant_type', tokenInfo.grant_type);
    form.append('client_id', tokenInfo.client_id);
    form.append('client_secret', tokenInfo.client_secret);
    form.append('code', code);
    //TODO URL 需要改写，并且一定要识别好参数，不能多也不能少，否则无法飞书正常跳转
    form.append(
      'redirect_uri',
      'http://localhost:3000/chat_new1/share?shareId=3mnm58stef6ztuiss5ieylp1'
    );

    const response = await fetch(tokenInfo.token_url, {
      method: 'POST',
      body: form.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
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

    if (response.error) {
      jsonRes(res, {
        code: 401,
        error: response.error_description
      });
      return;
    }

    //TODO 解决报错用户名不存问题,有二次重进问题

    const userInfoUrl = `${tokenInfo.user_info_url}?client_id=${tokenInfo.client_id}`;
    const userInfoResponse = await fetch(userInfoUrl, {
      method: 'GET',
      headers: { Authorization: `bearer ${response.access_token}` }
    }).then((useInfoRes) => useInfoRes.json());
    let authUser;
    let userName;
    if (!userInfoResponse.status) {
      userName = userInfoResponse.phone_number.replace('+86', '');
      authUser = await MongoUser.findOne({
        username: userName
      });
    } else {
      jsonRes(res, {
        code: 401,
        error: 'Unauthorized'
      });
      return;
    }

    if (!authUser) {
      const psw = process.env.DEFAULT_ROOT_PSW || '123456';
      authUser = await MongoUser.create({
        username: userName,
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
