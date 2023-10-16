// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@/service/response';
import { authUser } from '@fastgpt/support/user/auth';
import { MongoUser } from '@fastgpt/support/user/schema';
import { connectToDatabase } from '@/service/mongo';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    await connectToDatabase();
    const { oldPsw, newPsw } = req.body as { oldPsw: string; newPsw: string };

    if (!oldPsw || !newPsw) {
      throw new Error('Params is missing');
    }

    const { userId } = await authUser({ req, authToken: true });

    // auth old password
    const user = await MongoUser.findOne({
      _id: userId,
      password: oldPsw
    });

    if (!user) {
      throw new Error('user.Old password is error');
    }

    // 更新对应的记录
    await MongoUser.findByIdAndUpdate(userId, {
      password: newPsw
    });

    jsonRes(res, {
      data: {
        user
      }
    });
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
