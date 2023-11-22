import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  useTheme,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton
} from '@chakra-ui/react';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useEditTitle } from '@/web/common/hooks/useEditTitle';
import { useRouter } from 'next/router';
import Avatar from '@/components/Avatar';
import MyTooltip from '@/components/MyTooltip';
import MyIcon from '@/components/Icon';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '@/web/common/hooks/useConfirm';
import Tabs from '@/components/Tabs';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useQuery } from '@tanstack/react-query';
import { Popover } from 'antd';
import SliderApps from './SliderApps';
import styles from '../index.module.scss';

type HistoryItemType = {
  id: string;
  title: string;
  customTitle?: string;
  top?: boolean;
};

enum TabEnum {
  'app' = 'app',
  'history' = 'history'
}

const ChatHistorySlider = ({
  appId,
  appName,
  appAvatar,
  history,
  activeChatId,
  onChangeChat,
  onDelHistory,
  onClearHistory,
  onSetHistoryTop,
  onSetCustomTitle,
  onClose
}: {
  appId?: string;
  appName: string;
  appAvatar: string;
  history: HistoryItemType[];
  activeChatId: string;
  onChangeChat: (chatId?: string) => void;
  onDelHistory: (chatId: string) => void;
  onClearHistory: () => void;
  onSetHistoryTop?: (e: { chatId: string; top: boolean }) => void;
  onSetCustomTitle?: (e: { chatId: string; title: string }) => void;
  onClose: () => void;
}) => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { isPc } = useSystemStore();
  const { myApps, loadMyApps, userInfo } = useUserStore();

  const [currentTab, setCurrentTab] = useState<`${TabEnum}`>(TabEnum.history);
  const [open, setOpen] = useState(false);
  const isShare = useMemo(() => router.pathname === '/chat_new1/share', [router.pathname]);

  // custom title edit
  const { onOpenModal, EditModal: EditTitleModal } = useEditTitle({
    title: '自定义历史记录标题',
    placeholder: '如果设置为空，会自动跟随聊天记录。'
  });
  const { openConfirm, ConfirmModal } = useConfirm({
    content: isShare
      ? t('chat.Confirm to clear share chat histroy')
      : t('chat.Confirm to clear history')
  });

  const concatHistory = useMemo<HistoryItemType[]>(
    () =>
      !activeChatId ? [{ id: activeChatId, title: t('chat.New Chat') }].concat(history) : history,
    [activeChatId, history, t]
  );

  useQuery(['init'], () => {
    if (isShare) {
      setCurrentTab(TabEnum.history);
      return null;
    }
    return loadMyApps(false);
  });

  const handleSwitch = () => {
    setOpen(!open);
  };

  return (
    <Flex
      position={'relative'}
      flexDirection={'column'}
      w={'100%'}
      h={'100%'}
      bg={isPc ? 'white' : '#272727'}
      borderRight={['', theme.borders.base]}
      whiteSpace={'nowrap'}
    >
      {isPc && (
        <MyTooltip label={''} offset={[0, 0]}>
          <Flex
            pt={5}
            pb={2}
            px={[2, 5]}
            justifyContent={'space-between'}
            alignItems={'center'}
            cursor={appId ? 'pointer' : 'default'}
          >
            <Flex
              alignItems={'center'}
              onClick={() =>
                appId &&
                router.replace({
                  pathname: '/app/detail',
                  query: { appId }
                })
              }
            >
              <Avatar src={appAvatar} w={'44px'} fontSize={'20px'} />
              <Box flex={'1 0 0'} w={0} ml={2}>
                <Box fontWeight={'bold'} className={'textEllipsis'}>
                  {appName}
                </Box>
                <Box fontSize={'12px'} color={'#999999'}>
                  点击切换知识库
                </Box>
              </Box>
            </Flex>

            {isShare && (
              <Popover
                placement={'bottomRight'}
                open={open}
                trigger="click"
                overlayClassName={styles.sharePopover}
                onOpenChange={(e) => setOpen(e)}
                content={<SliderApps appId={''} callback={() => setOpen(false)} />}
              >
                <MyIcon name={'switch'} w={'16px'} p={'10px'} onClick={(e) => handleSwitch()} />
              </Popover>
            )}
          </Flex>
        </MyTooltip>
      )}

      {/* menu */}
      <Flex
        w={'100%'}
        px={[2, 5]}
        h={'42px'}
        my={5}
        alignItems={'center'}
        justifyContent={'center'}
        position={isPc ? 'relative' : 'fixed'}
        bottom={isPc ? '' : '0'}
        zIndex={1}
      >
        {/* {!isPc && !isShare && (
          <Tabs
            w={'120px'}
            mr={2}
            list={[
              { label: 'App', id: TabEnum.app },
              { label: 'chat.History', id: TabEnum.history }
            ]}
            activeId={currentTab}
            onChange={(e) => setCurrentTab(e as `${TabEnum}`)}
          />
        )} */}
        <Button
          // variant={'base'}
          // flex={1}
          width={isPc ? '100%' : '90%'}
          h={'100%'}
          bg={'myBlue.700'}
          color={'white'}
          borderRadius={'xl'}
          leftIcon={<MyIcon name={'chat'} w={'16px'} />}
          overflow={'hidden'}
          onClick={() => onChangeChat()}
        >
          {t('chat.Create New Chat')}
        </Button>

        {isPc && (
          <IconButton
            ml={3}
            h={'100%'}
            variant={'base'}
            aria-label={''}
            borderRadius={'xl'}
            onClick={openConfirm(onClearHistory)}
          >
            <MyIcon name={'delete1'} w={'16px'} />
          </IconButton>
        )}
      </Flex>

      {!isPc && (
        <Flex
          w={'100%'}
          px={[2, 5]}
          h={'42px'}
          my={5}
          fontSize={'18px'}
          color={'#fff'}
          alignItems={'center'}
          justifyContent={'space-between'}
        >
          对话记录
          <IconButton
            ml={3}
            h={'100%'}
            border={'none'}
            variant={'base'}
            aria-label={''}
            onClick={openConfirm(onClearHistory)}
          >
            <MyIcon name={'delete1'} w={'16px'} color={'#999999'} />
          </IconButton>
        </Flex>
      )}

      <Box flex={'1 0 0'} h={0} px={[2, 5]} pb={'60px'} overflow={'overlay'}>
        {/* chat history */}
        {(currentTab === TabEnum.history || isPc) && (
          <>
            {concatHistory.map((item, i) => (
              <Flex
                position={'relative'}
                key={item.id || `${i}`}
                alignItems={'center'}
                py={3}
                px={4}
                cursor={'pointer'}
                userSelect={'none'}
                borderRadius={'lg'}
                mb={2}
                _hover={{
                  bg: isPc ? 'myGray.100' : '#222331',
                  '& .more': {
                    display: 'block'
                  }
                }}
                bg={item.top ? '#E2E2E2 !important' : ''}
                {...(item.id === activeChatId
                  ? {
                      backgroundColor: isPc ? 'myBlue.100 !important' : '#222331',
                      color: isPc ? 'myBlue.700' : '#fff'
                    }
                  : {
                      color: isPc ? '' : '#fff',
                      onClick: () => {
                        onChangeChat(item.id);
                      }
                    })}
              >
                <MyIcon
                  name={`chat${Math.floor(Math.random() * (8 - 1 + 1)) + 1}` as any}
                  w={'24px'}
                />
                <Box flex={'1 0 0'} ml={3} className="textEllipsis">
                  {item.customTitle || item.title}
                  {item.top && <MyIcon ml={2} name={'top'} w={'16px'} />}
                </Box>
                {!!item.id && (
                  <Box className="more" display={['block', 'none']}>
                    <Menu autoSelect={false} isLazy offset={[0, 5]}>
                      <MenuButton
                        _hover={{ bg: 'white' }}
                        cursor={'pointer'}
                        borderRadius={'md'}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <MyIcon name={'more'} w={'14px'} p={1} />
                      </MenuButton>
                      <MenuList color={'myGray.700'} minW={`90px !important`}>
                        {onSetHistoryTop && (
                          <MenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetHistoryTop({ chatId: item.id, top: !item.top });
                            }}
                          >
                            <MyIcon mr={2} name={'setTop'} w={'16px'}></MyIcon>
                            {item.top ? '取消置顶' : '置顶'}
                          </MenuItem>
                        )}
                        {onSetCustomTitle && (
                          <MenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenModal({
                                defaultVal: item.customTitle || item.title,
                                onSuccess: (e) =>
                                  onSetCustomTitle({
                                    chatId: item.id,
                                    title: e
                                  })
                              });
                            }}
                          >
                            <MyIcon mr={2} name={'edit1'} w={'16px'}></MyIcon>
                            编辑对话名称
                          </MenuItem>
                        )}
                        <MenuItem
                          _hover={{ color: 'red.500' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelHistory(item.id);
                            if (item.id === activeChatId) {
                              onChangeChat();
                            }
                          }}
                        >
                          <MyIcon mr={2} name={'delete1'} w={'16px'}></MyIcon>
                          从对话列表删除
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </Box>
                )}
              </Flex>
            ))}
          </>
        )}
        {currentTab === TabEnum.app && !isPc && (
          <>
            {myApps.map((item) => (
              <Flex
                key={item._id}
                py={2}
                px={3}
                mb={3}
                borderRadius={'lg'}
                alignItems={'center'}
                {...(item._id === appId
                  ? {
                      backgroundColor: 'myBlue.100 !important',
                      color: 'myBlue.700'
                    }
                  : {
                      onClick: () => {
                        router.replace({
                          query: {
                            appId: item._id
                          }
                        });
                        onClose();
                      }
                    })}
              >
                <Avatar src={item.avatar} w={'24px'} />
                <Box ml={2} className={'textEllipsis'}>
                  {item.name}
                </Box>
              </Flex>
            ))}
          </>
        )}
      </Box>

      {/* {!isPc && appId && (
        <Flex
          mt={2}
          borderTop={theme.borders.base}
          alignItems={'center'}
          cursor={'pointer'}
          p={3}
          onClick={() => router.push('/app/list')}
        >
          <IconButton
            mr={3}
            icon={<MyIcon name={'backFill'} w={'18px'} color={'myBlue.600'} />}
            bg={'white'}
            boxShadow={'1px 1px 9px rgba(0,0,0,0.15)'}
            h={'28px'}
            size={'sm'}
            borderRadius={'50%'}
            aria-label={''}
          />
          {t('chat.Exit Chat')}
        </Flex>
      )} */}
      <EditTitleModal />
      <ConfirmModal />
    </Flex>
  );
};

export default ChatHistorySlider;
