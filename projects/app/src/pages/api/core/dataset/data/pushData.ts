/* push data to training queue */
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@/service/response';
import { connectToDatabase } from '@/service/mongo';
import { MongoDatasetTraining } from '@fastgpt/service/core/dataset/training/schema';
import { authUser } from '@fastgpt/service/support/user/auth';
import { authCollection } from '@fastgpt/service/core/dataset/auth';
import { withNextCors } from '@fastgpt/service/common/middle/cors';
import { TrainingModeEnum } from '@fastgpt/global/core/dataset/constant';
import { startQueue } from '@/service/utils/tools';
import { DatasetChunkItemType } from '@fastgpt/global/core/dataset/type';
import { countPromptTokens } from '@/global/common/tiktoken';
import type { PushDataResponse } from '@/global/core/api/datasetRes.d';
import type { PushDataProps } from '@/global/core/api/datasetReq.d';
import { getVectorModel } from '@/service/core/ai/model';

const modeMap = {
  [TrainingModeEnum.index]: true,
  [TrainingModeEnum.qa]: true
};

export default withNextCors(async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    await connectToDatabase();
    const { collectionId, data, mode = TrainingModeEnum.index } = req.body as PushDataProps;

    if (!collectionId || !Array.isArray(data)) {
      throw new Error('collectionId or data is empty');
    }

    if (modeMap[mode] === undefined) {
      throw new Error('Mode is not index or qa');
    }

    if (data.length > 200) {
      throw new Error('Data is too long, max 200');
    }

    // 凭证校验
    const { userId } = await authUser({ req, authToken: true, authApiKey: true });

    jsonRes<PushDataResponse>(res, {
      data: await pushDataToDatasetCollection({
        ...req.body,
        userId
      })
    });
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
});

export async function pushDataToDatasetCollection({
  userId,
  collectionId,
  data,
  mode,
  prompt,
  billId
}: { userId: string } & PushDataProps): Promise<PushDataResponse> {
  // auth dataset & get training model
  const {
    dataset: { _id: datasetId, vectorModel }
  } = await authCollection({
    userId,
    collectionId
  });
  const vectorModelData = getVectorModel(vectorModel);

  const modeMap = {
    [TrainingModeEnum.index]: {
      maxToken: vectorModelData.maxToken * 1.5,
      model: vectorModelData.model
    },
    [TrainingModeEnum.qa]: {
      maxToken: global.qaModels[0].maxToken * 0.8,
      model: global.qaModels[0].model
    }
  };

  // filter repeat or equal content
  const set = new Set();
  const filterResult: Record<string, DatasetChunkItemType[]> = {
    success: [],
    overToken: [],
    repeat: [],
    error: []
  };

  await Promise.all(
    data.map(async (item) => {
      if (!item.q) {
        filterResult.error.push(item);
        return;
      }

      const text = item.q + item.a;

      // count q token
      const token = countPromptTokens(item.q);

      if (token > modeMap[mode].maxToken) {
        filterResult.overToken.push(item);
        return;
      }

      if (set.has(text)) {
        filterResult.repeat.push(item);
      } else {
        filterResult.success.push(item);
        set.add(text);
      }
    })
  );

  // 插入记录
  const insertRes = await MongoDatasetTraining.insertMany(
    filterResult.success.map((item) => ({
      userId,
      datasetId,
      datasetCollectionId: collectionId,
      billId,
      mode,
      prompt,
      model: modeMap[mode].model,
      q: item.q,
      a: item.a
    }))
  );

  insertRes.length > 0 && startQueue();
  delete filterResult.success;

  return {
    insertLen: insertRes.length,
    ...filterResult
  };
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    },
    responseLimit: '12mb'
  }
};
