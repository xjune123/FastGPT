import React, { useMemo, useState } from 'react';
import { Flex, Box, Divider } from '@chakra-ui/react';
import { ChatHistoryItemResType, QuoteItemType } from '@/types/chat';
import { FlowModuleTypeEnum } from '@/constants/flow';
import MyIcon from '@/components/Icon';
import { RawFileText } from '@/pages/kb/detail/components/InputDataModal';
import { useTranslation } from 'react-i18next';

const FileList = ({ responseData = [] }: { responseData?: ChatHistoryItemResType[] }) => {
  const { t } = useTranslation();
  const [quoteModalData, setQuoteModalData] = useState<QuoteItemType[]>();
  const {
    chatAccount,
    quoteList = [],
    historyPreview = [],
    runningTime = 0
  } = useMemo(() => {
    const chatData = responseData.find((item) => item.moduleType === FlowModuleTypeEnum.chatNode);
    return {
      chatAccount: responseData.filter((item) => item.moduleType === FlowModuleTypeEnum.chatNode)
        .length,
      quoteList: responseData
        .filter((item) => item.moduleType === FlowModuleTypeEnum.chatNode)
        .map((item) => item.quoteList)
        .flat()
        .filter((item) => item) as QuoteItemType[],
      historyPreview: chatData?.historyPreview,
      runningTime: +responseData.reduce((sum, item) => sum + (item.runningTime || 0), 0).toFixed(2)
    };
  }, [responseData]);

  function arrayUnique1(arr: any[], name: string) {
    const res = new Map();
    return arr.filter((item) => !res.has(item[name]) && res.set(item[name], 1));
  }
  // console.log("---", arrayUnique1(quoteList, 'source')) //可直接打印结果

  return responseData.length === 0 ? null : (
    <Flex flexDirection={'column'} mt={2} flexWrap={'wrap'}>
      <Divider />
      <Box color={'#999999'} mt={4} mb={3} fontSize={'sm'}>
        来源:
      </Box>
      {quoteList.length > 0 && (
        <Box>
          {arrayUnique1(quoteList, 'source').map((item) => (
            <Flex
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
              <MyIcon name={'word'} mr={2} />
              <RawFileText
                filename={item.source || t('common.Unknow') || 'Unknow'}
                fileId={item.file_id}
              />
            </Flex>
          ))}
        </Box>
      )}
    </Flex>
  );
};
export default FileList;
