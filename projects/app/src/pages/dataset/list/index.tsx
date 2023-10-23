import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Flex,
  Grid,
  useTheme,
  useDisclosure,
  Card,
  MenuButton,
  Image
} from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useDatasetStore } from '@/web/core/dataset/store/dataset';
import PageContainer from '@/components/PageContainer';
import { useConfirm } from '@/web/common/hooks/useConfirm';
import { AddIcon } from '@chakra-ui/icons';
import { useQuery } from '@tanstack/react-query';
import {
  delDatasetById,
  getDatasetPaths,
  putDatasetById,
  exportDatasetData,
  postCreateDataset
} from '@/web/core/dataset/api';
import { useTranslation } from 'react-i18next';
import Avatar from '@/components/Avatar';
import MyIcon from '@/components/Icon';
import { serviceSideProps } from '@/web/common/utils/i18n';
import dynamic from 'next/dynamic';
import { FolderAvatarSrc, DatasetTypeEnum } from '@fastgpt/global/core/dataset/constant';
import Tag from '@/components/Tag';
import MyMenu from '@/components/MyMenu';
import { useRequest } from '@/web/common/hooks/useRequest';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useEditTitle } from '@/web/common/hooks/useEditTitle';
import { feConfigs } from '@/web/common/system/staticData';
import EditFolderModal, { useEditFolder } from '../component/EditFolderModal';
import { useDrag } from '@/web/common/hooks/useDrag';

const CreateModal = dynamic(() => import('./component/CreateModal'), { ssr: false });
const MoveModal = dynamic(() => import('./component/MoveModal'), { ssr: false });

const Kb = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { parentId } = router.query as { parentId: string };
  const { setLoading } = useSystemStore();

  const DeleteTipsMap = useRef({
    [DatasetTypeEnum.folder]: t('dataset.deleteFolderTips'),
    [DatasetTypeEnum.dataset]: t('dataset.deleteDatasetTips')
  });

  const { openConfirm, ConfirmModal } = useConfirm({
    title: t('common.Delete Warning'),
    content: ''
  });
  const { myDatasets, loadDatasets, setDatasets, updateDataset } = useDatasetStore();
  const { onOpenModal: onOpenTitleModal, EditModal: EditTitleModal } = useEditTitle({
    title: t('Rename')
  });
  const { moveDataId, setMoveDataId, dragStartId, setDragStartId, dragTargetId, setDragTargetId } =
    useDrag();

  const {
    isOpen: isOpenCreateModal,
    onOpen: onOpenCreateModal,
    onClose: onCloseCreateModal
  } = useDisclosure();
  const { editFolderData, setEditFolderData } = useEditFolder();

  /* 点击删除 */
  const { mutate: onclickDelDataset } = useRequest({
    mutationFn: async (id: string) => {
      setLoading(true);
      await delDatasetById(id);
      return id;
    },
    onSuccess(id: string) {
      setDatasets(myDatasets.filter((item) => item._id !== id));
    },
    onSettled() {
      setLoading(false);
    },
    successToast: t('common.Delete Success'),
    errorToast: t('dataset.Delete Dataset Error')
  });

  // export dataset to csv
  const { mutate: onclickExport } = useRequest({
    mutationFn: (datasetId: string) => {
      setLoading(true);
      return exportDatasetData({ datasetId });
    },
    onSettled() {
      setLoading(false);
    },
    successToast: `导出成功，下次导出需要 ${feConfigs?.limit?.exportLimitMinutes} 分钟后`,
    errorToast: '导出异常'
  });

  const { data, refetch } = useQuery(['loadDataset', parentId], () => {
    return Promise.all([loadDatasets(parentId), getDatasetPaths(parentId)]);
  });

  const paths = useMemo(
    () => [
      {
        parentId: '',
        parentName: t('dataset.My Dataset')
      },
      ...(data?.[1] || [])
    ],
    [data, t]
  );

  return (
    <PageContainer>
      <Flex pt={3} px={5} alignItems={'center'}>
        {/* url path */}
        {!!parentId ? (
          <Flex flex={1}>
            {paths.map((item, i) => (
              <Flex key={item.parentId} mr={2} alignItems={'center'}>
                <Box
                  fontSize={['sm', 'lg']}
                  px={[0, 2]}
                  py={1}
                  borderRadius={'md'}
                  {...(i === paths.length - 1
                    ? {
                        cursor: 'default'
                      }
                    : {
                        cursor: 'pointer',
                        _hover: {
                          bg: 'myGray.100'
                        },
                        onClick: () => {
                          router.push({
                            query: {
                              parentId: item.parentId
                            }
                          });
                        }
                      })}
                >
                  {item.parentName}
                </Box>
                {i !== paths.length - 1 && (
                  <MyIcon name={'rightArrowLight'} color={'myGray.500'} w={['18px', '24px']} />
                )}
              </Flex>
            ))}
          </Flex>
        ) : (
          <Box flex={1} className="textlg" letterSpacing={1} fontSize={'24px'} fontWeight={'bold'}>
            我的知识库
          </Box>
        )}

        <MyMenu
          offset={[-30, 10]}
          width={120}
          Button={
            <MenuButton
              _hover={{
                color: 'myBlue.600'
              }}
            >
              <Flex
                alignItems={'center'}
                border={theme.borders.base}
                px={5}
                py={2}
                borderRadius={'md'}
                cursor={'pointer'}
              >
                <AddIcon mr={2} />
                <Box>{t('Create New')}</Box>
              </Flex>
            </MenuButton>
          }
          menuList={[
            {
              child: (
                <Flex>
                  <Image src={FolderAvatarSrc} alt={''} w={'20px'} mr={1} />
                  {t('Folder')}
                </Flex>
              ),
              onClick: () => setEditFolderData({})
            },
            {
              child: (
                <Flex>
                  <Image src={'/imgs/module/db.png'} alt={''} w={'20px'} mr={1} />
                  {t('Dataset')}
                </Flex>
              ),
              onClick: onOpenCreateModal
            }
          ]}
        />
      </Flex>
      <Grid
        p={5}
        gridTemplateColumns={['1fr', 'repeat(3,1fr)', 'repeat(4,1fr)', 'repeat(5,1fr)']}
        gridGap={5}
        userSelect={'none'}
      >
        {myDatasets.map((dataset) => (
          <Card
            display={'flex'}
            flexDirection={'column'}
            key={dataset._id}
            py={4}
            px={5}
            cursor={'pointer'}
            h={'130px'}
            border={theme.borders.md}
            boxShadow={'none'}
            position={'relative'}
            data-drag-id={dataset.type === DatasetTypeEnum.folder ? dataset._id : undefined}
            borderColor={dragTargetId === dataset._id ? 'myBlue.600' : ''}
            draggable
            onDragStart={(e) => {
              setDragStartId(dataset._id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              const targetId = e.currentTarget.getAttribute('data-drag-id');
              if (!targetId) return;
              DatasetTypeEnum.folder && setDragTargetId(targetId);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragTargetId(undefined);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              if (!dragTargetId || !dragStartId || dragTargetId === dragStartId) return;
              // update parentId
              try {
                await putDatasetById({
                  id: dragStartId,
                  parentId: dragTargetId
                });
                refetch();
              } catch (error) {}
              setDragTargetId(undefined);
            }}
            _hover={{
              boxShadow: '1px 1px 10px rgba(0,0,0,0.2)',
              borderColor: 'transparent',
              '& .delete': {
                display: 'block'
              }
            }}
            onClick={() => {
              if (dataset.type === DatasetTypeEnum.folder) {
                router.push({
                  pathname: '/dataset/list',
                  query: {
                    parentId: dataset._id
                  }
                });
              } else if (dataset.type === DatasetTypeEnum.dataset) {
                router.push({
                  pathname: '/dataset/detail',
                  query: {
                    datasetId: dataset._id
                  }
                });
              }
            }}
          >
            <MyMenu
              offset={[-30, 10]}
              width={120}
              Button={
                <MenuButton
                  position={'absolute'}
                  top={3}
                  right={3}
                  w={'22px'}
                  h={'22px'}
                  borderRadius={'md'}
                  _hover={{
                    color: 'myBlue.600',
                    '& .icon': {
                      bg: 'myGray.100'
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MyIcon
                    className="icon"
                    name={'more'}
                    h={'16px'}
                    w={'16px'}
                    px={1}
                    py={1}
                    borderRadius={'md'}
                    cursor={'pointer'}
                  />
                </MenuButton>
              }
              menuList={[
                {
                  child: (
                    <Flex alignItems={'center'}>
                      <MyIcon name={'edit'} w={'14px'} mr={2} />
                      {t('Rename')}
                    </Flex>
                  ),
                  onClick: () =>
                    onOpenTitleModal({
                      defaultVal: dataset.name,
                      onSuccess: (val) => {
                        if (val === dataset.name || !val) return;
                        updateDataset({ id: dataset._id, name: val });
                      }
                    })
                },
                {
                  child: (
                    <Flex alignItems={'center'}>
                      <MyIcon name={'moveLight'} w={'14px'} mr={2} />
                      {t('Move')}
                    </Flex>
                  ),
                  onClick: () => setMoveDataId(dataset._id)
                },
                {
                  child: (
                    <Flex alignItems={'center'}>
                      <MyIcon name={'export'} w={'14px'} mr={2} />
                      {t('Export')}
                    </Flex>
                  ),
                  onClick: () => onclickExport(dataset._id)
                },
                {
                  child: (
                    <Flex alignItems={'center'}>
                      <MyIcon name={'delete'} w={'14px'} mr={2} />
                      {t('common.Delete')}
                    </Flex>
                  ),
                  onClick: () => {
                    openConfirm(
                      () => onclickDelDataset(dataset._id),
                      undefined,
                      DeleteTipsMap.current[dataset.type]
                    )();
                  }
                }
              ]}
            />
            <Flex alignItems={'center'} h={'38px'}>
              <Avatar src={dataset.avatar} borderRadius={'lg'} w={'28px'} />
              <Box ml={3}>{dataset.name}</Box>
            </Flex>
            <Box flex={'1 0 0'} overflow={'hidden'} pt={2}>
              <Flex>
                {dataset.tags.map((tag, i) => (
                  <Tag key={i} mr={2} mb={2}>
                    {tag}
                  </Tag>
                ))}
              </Flex>
            </Box>
            <Flex justifyContent={'flex-end'} alignItems={'center'} fontSize={'sm'}>
              {dataset.type === DatasetTypeEnum.folder ? (
                <Box color={'myGray.500'}>{t('Folder')}</Box>
              ) : (
                <>
                  <MyIcon mr={1} name="kbTest" w={'12px'} />
                  <Box color={'myGray.500'}>{dataset.vectorModel.name}</Box>
                </>
              )}
            </Flex>
          </Card>
        ))}
      </Grid>
      {myDatasets.length === 0 && (
        <Flex mt={'35vh'} flexDirection={'column'} alignItems={'center'}>
          <MyIcon name="empty" w={'48px'} h={'48px'} color={'transparent'} />
          <Box mt={2} color={'myGray.500'}>
            还没有知识库，快去创建一个吧！
          </Box>
        </Flex>
      )}
      <ConfirmModal />
      <EditTitleModal />
      {isOpenCreateModal && <CreateModal onClose={onCloseCreateModal} parentId={parentId} />}
      {!!editFolderData && (
        <EditFolderModal
          onClose={() => setEditFolderData(undefined)}
          editCallback={async (name) => {
            try {
              if (editFolderData.id) {
                await putDatasetById({
                  id: editFolderData.id,
                  name
                });
              } else {
                await postCreateDataset({
                  parentId,
                  name,
                  type: DatasetTypeEnum.folder,
                  avatar: FolderAvatarSrc,
                  tags: []
                });
              }
              refetch();
            } catch (error) {
              return Promise.reject(error);
            }
          }}
          isEdit={!!editFolderData.id}
          name={editFolderData.name}
        />
      )}
      {!!moveDataId && (
        <MoveModal
          moveDataId={moveDataId}
          onClose={() => setMoveDataId('')}
          onSuccess={() => {
            refetch();
            setMoveDataId('');
          }}
        />
      )}
    </PageContainer>
  );
};

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content))
    }
  };
}

export default Kb;
