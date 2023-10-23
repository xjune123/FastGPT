import React, { useMemo, useState } from 'react';
import { Flex, Box, Divider } from '@chakra-ui/react';
import { ChatHistoryItemResType } from '@/types/chat';
import { FlowModuleTypeEnum } from '@/constants/flow';
import MyIcon from '@/components/Icon';
import type { SearchDataResponseItemType } from '@fastgpt/global/core/dataset/type';
import { RawSourceText } from '@/pages/dataset/detail/components/InputDataModal';
// import { RawFileText } from '@/pages/kb/detail/components/InputDataModal';
import { useTranslation } from 'react-i18next';
import styles from './index.module.scss';
type QuoteItemType = {
  file_id?: string;
  filename: string;
};
const FileList = ({ responseData = [] }: { responseData?: ChatHistoryItemResType[] }) => {
  const { t } = useTranslation();
  const [quoteModalData, setQuoteModalData] = useState<SearchDataResponseItemType[]>();
  const [isShowMore, setIsShowMore] = useState(false);
  const { quoteList = [] } = useMemo(() => {
    const chatData = responseData.find((item) => item.moduleType === FlowModuleTypeEnum.chatNode);
    return {
      chatAccount: responseData.filter((item) => item.moduleType === FlowModuleTypeEnum.chatNode)
        .length,
      quoteList: responseData
        .filter((item) => item.moduleType === FlowModuleTypeEnum.chatNode)
        .map((item) => item.quoteList)
        .flat()
        .filter((item) => item) as SearchDataResponseItemType[],
      historyPreview: chatData?.historyPreview,
      runningTime: +responseData.reduce((sum, item) => sum + (item.runningTime || 0), 0).toFixed(2)
    };
  }, [responseData]);

  function arrayUnique1(arr: any[], name: string) {
    const res = new Map();
    const list = arr
      .filter((item) => !res.has(item[name]) && res.set(item[name], 1))
      .filter(
        (item) =>
          item.sourceName !== '手动录入' &&
          item.sourceName !== '未知来源' &&
          item.sourceName !== 'kb.Manual Data'
      );
    return list.slice(0, isShowMore ? quoteList.length : 3);
  }

  const getFileType = (sourceName: string) => {
    const index = sourceName?.lastIndexOf('.');
    let type: string = sourceName?.substring(index + 1);

    switch (type) {
      case 'ppt':
        return 'pdf1';
      case 'pdf':
        return 'pdf1';
      default:
        return 'word';
    }
  };

  return responseData.length === 0 ? null : (
    <Flex flexDirection={'column'} mt={2} flexWrap={'wrap'}>
      {arrayUnique1(quoteList, 'sourceName').length > 0 && <Divider />}
      {arrayUnique1(quoteList, 'sourceName').length > 0 && (
        <Box color={'#999999'} mt={4} mb={3} fontSize={'sm'}>
          来源:
        </Box>
      )}
      {quoteList.length > 0 && (
        <Box>
          {arrayUnique1(quoteList, 'sourceName').map((item) => (
            <Flex
              key={item.id}
              alignItems={'center'}
              cursor={'pointer'}
              bg={'white'}
              borderRadius={8}
              mb={2}
              lineHeight={9}
              pl={2}
              pr={2}
              onClick={() => setQuoteModalData(quoteList)}
            >
              <MyIcon name={getFileType(item.sourceName)} mr={2} />
              <RawSourceText sourceName={item.sourceName} sourceId={item.sourceId} />
            </Flex>
          ))}
          {arrayUnique1(quoteList, 'sourceName').length > 3 && (
            <Flex justifyContent={'center'} alignItems={'center'} cursor={'pointer'}>
              <Flex
                w={95}
                h={10}
                bg={'#EAEBEB'}
                borderRadius={16}
                justifyContent={'center'}
                alignItems={'center'}
                onClick={() => setIsShowMore(!isShowMore)}
              >
                展开更多
                <MyIcon
                  name="arrow"
                  className={styles.show_more}
                  transform={isShowMore ? 'rotate(180deg)' : 'rotate(0deg)'}
                />
              </Flex>
            </Flex>
          )}
        </Box>
      )}
    </Flex>
  );
};
export default FileList;
