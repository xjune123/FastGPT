import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@/service/response';
import { authUser } from '@fastgpt/support/user/auth';
import { connectToDatabase } from '@/service/mongo';
import { PgClient } from '@/service/pg';
import { PgDatasetTableName } from '@/constants/plugin';
import { DatasetSpecialIdEnum } from '@fastgpt/core/dataset/constant';
import { Types, connectionMongo } from '@fastgpt/common/mongo';
import { delay } from '@/utils/tools';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let initFileIds: string[] = [];
  try {
    const { limit = 100 } = req.body;
    await connectToDatabase();
    await authUser({ req, authRoot: true });

    console.log('count rows');
    // 去重获取 fileId
    const { rows } = await PgClient.query(`SELECT DISTINCT file_id
    FROM ${PgDatasetTableName} WHERE file_id IS NOT NULL AND file_id != '';
    `);
    console.log('count rows success', rows.length);
    console.log('start filter');
    for (let i = 0; i < rows.length; i += limit) {
      await init(rows.slice(i, i + limit), initFileIds);
      console.log(i);
    }

    for (let i = 0; i < initFileIds.length; i++) {
      await PgClient.query(`UPDATE ${PgDatasetTableName}
      SET file_id = '${DatasetSpecialIdEnum.manual}'
      WHERE file_id = '${initFileIds[i]}'`);
      console.log('update: ', initFileIds[i]);
    }

    const { rows: emptyIds } = await PgClient.query(
      `SELECT id FROM ${PgDatasetTableName} WHERE file_id IS NULL OR file_id=''`
    );
    console.log('filter success');
    console.log(emptyIds.length);

    await delay(5000);
    console.log('start update');

    async function start(start: number) {
      for (let i = start; i < emptyIds.length; i += limit) {
        await PgClient.query(`UPDATE ${PgDatasetTableName}
        SET file_id = '${DatasetSpecialIdEnum.manual}'
        WHERE id = '${emptyIds[i].id}'`);
        console.log('update: ', i, emptyIds[i].id);
      }
    }
    for (let i = 0; i < limit; i++) {
      start(i);
    }

    console.log('update success');

    jsonRes(res, {
      data: {
        empty: emptyIds.length
      }
    });
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}

async function init(rows: any[], initFileIds: string[]) {
  const collection = connectionMongo.connection.db.collection(`dataset.files`);

  /* 遍历所有的 fileId，去找有没有对应的文件，没有的话则改成manual */
  const updateResult = await Promise.allSettled(
    rows.map(async (item) => {
      // 找下是否有对应的文件
      const file = await collection.findOne({
        _id: new Types.ObjectId(item.file_id)
      });

      if (file) return '';
      // 没有文件的，改成manual
      initFileIds.push(item.file_id);

      return item.file_id;
    })
  );
  // @ts-ignore
  console.log(updateResult.filter((item) => item?.value).length);
}
