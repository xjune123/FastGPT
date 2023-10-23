import React, { useCallback, useMemo, useState } from 'react';
import { ModalBody, Box, useTheme, Flex, Progress } from '@chakra-ui/react';
import { getDatasetDataItemById } from '@/web/core/dataset/api';
import { useLoading } from '@/web/common/hooks/useLoading';
import { useToast } from '@/web/common/hooks/useToast';
import { getErrText } from '@fastgpt/global/common/error/utils';
import MyIcon from '@/components/Icon';
import InputDataModal, {
  RawSourceText,
  type InputDataType
} from '@/pages/dataset/detail/components/InputDataModal';
import MyModal from '../MyModal';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import type { SearchDataResponseItemType } from '@fastgpt/global/core/dataset/type';

const QuoteModal = ({
  rawSearch = [],
  onClose
}: {
  rawSearch: SearchDataResponseItemType[];
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const { setIsLoading, Loading } = useLoading();
  const [editInputData, setEditInputData] = useState<InputDataType>();

  const isShare = useMemo(() => router.pathname === '/chat/share', [router.pathname]);

  /**
   * click edit, get new kbDataItem
   */
  const onclickEdit = useCallback(
    async (item: InputDataType) => {
      if (!item.id) return;
      try {
        setIsLoading(true);
        const data = await getDatasetDataItemById(item.id);

        if (!data) {
          throw new Error('该数据已被删除');
        }

        setEditInputData(data);
      } catch (err) {
        toast({
          status: 'warning',
          title: getErrText(err)
        });
      }
      setIsLoading(false);
    },
    [setIsLoading, toast]
  );

  return (
    <>
      <MyModal
        isOpen={true}
        onClose={onClose}
        h={['90vh', '80vh']}
        isCentered
        minW={['90vw', '600px']}
        title={
          <>
            知识库引用({rawSearch.length}条)
            <Box fontSize={['xs', 'sm']} fontWeight={'normal'}>
              注意: 修改知识库内容成功后，此处不会显示变更情况。点击编辑后，会显示知识库最新的内容。
            </Box>
          </>
        }
      >
        <ModalBody
          pt={0}
          whiteSpace={'pre-wrap'}
          textAlign={'justify'}
          wordBreak={'break-all'}
          fontSize={'sm'}
        >
          {rawSearch.map((item, i) => (
            <Box
              key={i}
              flex={'1 0 0'}
              p={2}
              borderRadius={'lg'}
              border={theme.borders.base}
              _notLast={{ mb: 2 }}
              position={'relative'}
              _hover={{ '& .edit': { display: 'flex' } }}
              overflow={'hidden'}
            >
              {!isShare && (
                <Flex alignItems={'center'} mb={1}>
                  <RawSourceText sourceName={item.sourceName} sourceId={item.sourceId} />
                  <Box flex={'1'} />
                  {item.score && (
                    <>
                      <Progress
                        mx={2}
                        w={['60px', '100px']}
                        value={item.score * 100}
                        size="sm"
                        borderRadius={'20px'}
                        colorScheme="gray"
                        border={theme.borders.base}
                      />
                      <Box>{item.score.toFixed(4)}</Box>
                    </>
                  )}
                </Flex>
              )}

              <Box>{item.q}</Box>
              <Box>{item.a}</Box>
              {item.id && !isShare && (
                <Box
                  className="edit"
                  display={'none'}
                  position={'absolute'}
                  right={0}
                  top={0}
                  bottom={0}
                  w={'40px'}
                  bg={'rgba(255,255,255,0.9)'}
                  alignItems={'center'}
                  justifyContent={'center'}
                  boxShadow={'-10px 0 10px rgba(255,255,255,1)'}
                >
                  <MyIcon
                    name={'edit'}
                    w={'18px'}
                    h={'18px'}
                    cursor={'pointer'}
                    color={'myGray.600'}
                    _hover={{
                      color: 'myBlue.700'
                    }}
                    onClick={() => onclickEdit(item)}
                  />
                </Box>
              )}
            </Box>
          ))}
        </ModalBody>
        <Loading fixed={false} />
      </MyModal>
      {editInputData && editInputData.id && (
        <InputDataModal
          onClose={() => setEditInputData(undefined)}
          onSuccess={() => {
            console.log('更新引用成功');
          }}
          onDelete={() => {
            console.log('删除引用成功');
          }}
          datasetId={editInputData.datasetId}
          defaultValues={editInputData}
        />
      )}
    </>
  );
};

export default QuoteModal;
