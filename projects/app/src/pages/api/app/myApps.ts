import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@/service/response';
import { connectToDatabase, App } from '@/service/mongo';
import { authUser } from '@fastgpt/service/support/user/auth';
import { AppListItemType } from '@/types/app';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    await connectToDatabase();
    // 凭证校验
    const { userId } = await authUser({ req, authToken: true });

    const { token } = req.body;
    // 根据 获取模型信息
    const myApps = await fetch(`${tokenInfo.base_url}/pook/app/v1/queryUserApp`, {
      method: 'GET',
      headers: {
        Authorization: `bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NGUzMjA5ODJlNzA0NjdhYmE1ZWMxMmEiLCJleHAiOjE3MDAxMTg1NTUsImlhdCI6MTY5OTUxMzc1NX0.AJUdU9c8RZ7zU2hYUBF7m0oGnCoilwA8qr4CGIfJXkQ`,
        'Content-Type': 'application/json'
      }
    }).then((useInfoRes) => useInfoRes.json());

    jsonRes<AppListItemType[]>(res, {
      data: myApps
    });
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
