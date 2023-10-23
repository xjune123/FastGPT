import { postChunks2Dataset } from '@/web/core/dataset/api';
import { TrainingModeEnum } from '@fastgpt/global/core/dataset/constant';
import { DatasetChunkItemType } from '@fastgpt/global/core/dataset/type';
import { delay } from '@/utils/tools';

export async function chunksUpload({
  collectionId,
  billId,
  mode,
  chunks,
  prompt,
  rate = 150,
  onUploading
}: {
  collectionId: string;
  billId: string;
  mode: `${TrainingModeEnum}`;
  chunks: DatasetChunkItemType[];
  prompt?: string;
  rate?: number;
  onUploading?: (insertLen: number, total: number) => void;
}) {
  async function upload(data: DatasetChunkItemType[]) {
    return postChunks2Dataset({
      collectionId,
      data,
      mode,
      prompt,
      billId
    });
  }

  let successInsert = 0;
  let retryTimes = 10;
  for (let i = 0; i < chunks.length; i += rate) {
    try {
      const { insertLen } = await upload(chunks.slice(i, i + rate));
      onUploading && onUploading(insertLen, chunks.length);
      successInsert += insertLen;
    } catch (error) {
      if (retryTimes === 0) {
        return Promise.reject(error);
      }
      await delay(1000);
      retryTimes--;
      i -= rate;
    }
  }

  return { insertLen: successInsert };
}
