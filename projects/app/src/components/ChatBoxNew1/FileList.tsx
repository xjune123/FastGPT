import React, { useMemo, useState } from 'react';
import { Flex, Box, Divider } from '@chakra-ui/react';
import { ChatHistoryItemResType } from '@/types/chat';
import { FlowModuleTypeEnum } from '@/constants/flow';
import MyIcon from '@/components/Icon';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { Pagination, Carousel } from 'antd';
import type { SearchDataResponseItemType } from '@fastgpt/global/core/dataset/type';
import { RawSourceText } from '@/pages/dataset/detail/components/InputDataModal';
// import { RawFileText } from '@/pages/kb/detail/components/InputDataModal';
import { useTranslation } from 'react-i18next';
import styles from './index.module.scss';

const FileList = ({ responseData = [] }: { responseData?: ChatHistoryItemResType[] }) => {
  const { t } = useTranslation();
  const { isPc } = useSystemStore();

  const [quoteModalData, setQuoteModalData] = useState<SearchDataResponseItemType[]>();
  // const [isShowMore, setIsShowMore] = useState(false);
  const [isRotate, setIsRotate] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
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

  const newQuoteList = useMemo(() => {
    const res = new Map();
    let list = quoteList
      .filter((item) => !res.has(item['sourceId']) && res.set(item['sourceId'], 1))
      .filter(
        (item) =>
          item.sourceName !== '手动录入' &&
          item.sourceName !== '未知来源' &&
          item.sourceName !== 'kb.Manual Data'
      );
    return list;
  }, [quoteList]);

  const isShowMore = useMemo(() => {
    return newQuoteList.length > 3;
  }, [newQuoteList]);

  const getFileType = (sourceName: string) => {
    const index = sourceName?.lastIndexOf('.');
    let type: string = sourceName?.substring(index + 1);
    switch (type) {
      case 'ppt':
        return 'ppt';
      case 'pptx':
        return 'ppt';
      case 'pdf':
        return 'pdf1';
      default:
        return 'word';
    }
  };

  const getList = useMemo(() => {
    let _newQuoteList = newQuoteList;
    _newQuoteList = _newQuoteList.slice((currentPage - 1) * 10, currentPage * 10);
    if (isRotate) {
      _newQuoteList = _newQuoteList.slice(0, 3);
    }
    return _newQuoteList;
  }, [isRotate, currentPage]);

  const contentStyle: React.CSSProperties = {
    margin: 0,
    height: '160px',
    color: '#fff',
    lineHeight: '160px',
    textAlign: 'center'
  };

  const onPageChange = (page: number) => {
    setCurrentPage(page);
  };

  const filesContent = () => {
    return (
      <Box>
        {getList.map((item) => {
          return (
            <Flex
              key={item.id}
              alignItems={'center'}
              cursor={'pointer'}
              bg={isPc ? 'white' : '#F6F6F6'}
              borderRadius={8}
              mb={2}
              lineHeight={9}
              pl={2}
              pr={2}
              onClick={() => setQuoteModalData(quoteList)}
            >
              <MyIcon name={getFileType(item.sourceName)} mr={2} />
              {isPc ? (
                <RawSourceText sourceName={item.sourceName} sourceId={item.sourceId} />
              ) : (
                <Flex>{item.sourceName}</Flex>
              )}
            </Flex>
          );
        })}
        {isShowMore && (
          <Flex justifyContent={'center'} alignItems={'center'} cursor={'pointer'}>
            <Flex
              w={95}
              h={10}
              bg={'#EAEBEB'}
              borderRadius={16}
              justifyContent={'center'}
              alignItems={'center'}
              onClick={() => setIsRotate(!isRotate)}
            >
              展开更多
              <MyIcon
                name="arrow"
                className={styles.show_more}
                transform={isRotate ? 'rotate(180deg)' : 'rotate(0deg)'}
              />
            </Flex>
          </Flex>
        )}
      </Box>
    );
  };

  return responseData.length === 0 ? null : (
    <Flex flexDirection={'column'} mt={2} flexWrap={'wrap'}>
      {newQuoteList.length > 0 && <Divider />}
      {newQuoteList.length > 0 && (
        <Box color={'#999999'} mt={4} mb={3} fontSize={'sm'}>
          来源:
        </Box>
      )}
      {quoteList.length > 0 && (
        <Box>
          {isPc && filesContent()}
          {isPc && newQuoteList.length > 10 && (
            <Pagination
              current={currentPage}
              total={newQuoteList.length}
              className={styles.page}
              onChange={onPageChange}
            />
          )}
          {!isPc && (
            <Carousel style={{ width: 300 }} afterChange={onPageChange}>
              {filesContent()}
            </Carousel>
          )}
        </Box>
      )}
    </Flex>
  );
};
export default FileList;
