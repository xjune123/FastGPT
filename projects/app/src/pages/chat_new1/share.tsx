import React, { useCallback, useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getInitChatSiteInfo, delChatRecordById, putChatHistory } from '@/web/core/chat/api';
import {
  Box,
  Flex,
  useDisclosure,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  useTheme
} from '@chakra-ui/react';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useQuery } from '@tanstack/react-query';
import { streamFetch } from '@/web/common/api/fetch';
import { useChatStore } from '@/web/core/chat/storeChat';
import { useLoading } from '@/web/common/hooks/useLoading';
import { useToast } from '@/web/common/hooks/useToast';
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 12);
import type { ChatHistoryItemType } from '@/types/chat';
import { useTranslation } from 'react-i18next';

import ChatBox, { type ComponentRef, type StartChatFnProps } from '@/components/ChatBoxNew1';
import PageContainer from '@/components/PageContainer';
import SideBar from '@/components/SideBar';
import ChatHistorySlider from './components/ChatHistorySlider';
import SliderApps from './components/SliderApps';
import ChatHeader from './components/ChatHeader';
import { getErrText } from '@fastgpt/global/common/error/utils';
import { useUserStore } from '@/web/support/user/useUserStore';
import { serviceSideProps } from '@/web/common/utils/i18n';

const Chat = ({
  shareId,
  chatId,
  showHistory,
  authToken,
  appId
}: {
  shareId: string;
  chatId: string;
  showHistory: '0' | '1';
  authToken?: string;
  appId: string;
}) => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isEmbed, setIdEmbed] = useState(true);

  const ChatBoxRef = useRef<ComponentRef>(null);
  const forbidRefresh = useRef(false);

  const {
    lastChatAppId,
    setLastChatAppId,
    lastChatId,
    setLastChatId,
    history,
    loadHistory,
    updateHistory,
    delHistory,
    clearHistory,
    chatData,
    setChatData
  } = useChatStore();
  const { myApps, loadMyApps, userInfo } = useUserStore();

  const { isPc } = useSystemStore();
  const { Loading, setIsLoading } = useLoading();
  const { isOpen: isOpenSlider, onClose: onCloseSlider, onOpen: onOpenSlider } = useDisclosure();

  const startChat = useCallback(
    async ({ messages, controller, generatingMessage, variables }: StartChatFnProps) => {
      const prompts = messages.slice(-2);
      const completionChatId = chatId ? chatId : nanoid();

      const { responseText, responseData } = await streamFetch({
        data: {
          messages: prompts,
          variables,
          appId,
          chatId: completionChatId
        },
        onMessage: generatingMessage,
        abortSignal: controller
      });

      const newTitle = prompts[0].content?.slice(0, 20) || '新对话';

      // update history
      if (completionChatId !== chatId) {
        const newHistory: ChatHistoryItemType = {
          chatId: completionChatId,
          updateTime: new Date(),
          title: newTitle,
          appId,
          top: false
        };
        updateHistory(newHistory);
        if (controller.signal.reason !== 'leave') {
          forbidRefresh.current = true;
          router.replace({
            query: {
              chatId: completionChatId,
              appId
            }
          });
        }
      } else {
        const currentChat = history.find((item) => item.chatId === chatId);
        currentChat &&
          updateHistory({
            ...currentChat,
            updateTime: new Date(),
            title: newTitle
          });
      }
      // update chat window
      setChatData((state) => ({
        ...state,
        title: newTitle,
        history: ChatBoxRef.current?.getChatHistory() || state.history
      }));
      return { responseText, responseData, isNewChat: forbidRefresh.current };
    },
    [appId, chatId, history, router, setChatData, updateHistory]
  );

  // del one chat content
  const delOneHistoryItem = useCallback(
    async ({ contentId, index }: { contentId?: string; index: number }) => {
      if (!chatId || !contentId) return;

      try {
        setChatData((state) => ({
          ...state,
          history: state.history.filter((_, i) => i !== index)
        }));
        await delChatRecordById({ chatId, contentId });
      } catch (err) {
        console.log(err);
      }
    },
    [chatId, setChatData]
  );

  // get chat app info
  const loadChatInfo = useCallback(
    async ({
      appId,
      chatId,
      loading = false
    }: {
      appId: string;
      chatId: string;
      loading?: boolean;
    }) => {
      try {
        loading && setIsLoading(true);
        const res = await getInitChatSiteInfo({ appId, chatId });
        const history = res.history.map((item) => ({
          ...item,
          status: 'finish' as any
        }));

        setChatData({
          ...res,
          history
        });

        // have records.
        ChatBoxRef.current?.resetHistory(history);
        ChatBoxRef.current?.resetVariables(res.variables);
        if (res.history.length > 0) {
          setTimeout(() => {
            ChatBoxRef.current?.scrollToBottom('auto');
          }, 500);
        }
      } catch (e: any) {
        // reset all chat tore
        setLastChatAppId('');
        setLastChatId('');
        toast({
          title: getErrText(e, '初始化聊天失败'),
          status: 'error'
        });
        if (e?.code === 501) {
          router.replace('/app/list');
        } else {
          router.replace('/chat');
        }
      }
      setIsLoading(false);
      return null;
    },
    [setIsLoading, setChatData, router, setLastChatAppId, setLastChatId, toast]
  );
  // 初始化聊天框
  useQuery(['init', appId, chatId], () => {
    // pc: redirect to latest model chat
    if (!appId && lastChatAppId) {
      return router.replace({
        query: {
          appId: lastChatAppId,
          chatId: lastChatId
        }
      });
    }
    if (!appId && myApps[0]) {
      return router.replace({
        query: {
          appId: myApps[0]._id,
          chatId: lastChatId
        }
      });
    }
    if (!appId) {
      (async () => {
        const apps = await loadMyApps();
        if (apps.length === 0) {
          toast({
            status: 'error',
            title: t('chat.You need to a chat app')
          });
          router.replace('/app/list');
        } else {
          router.replace({
            query: {
              appId: apps[0]._id,
              chatId: lastChatId
            }
          });
        }
      })();
      return;
    }

    // store id
    appId && setLastChatAppId(appId);
    setLastChatId(chatId);

    if (forbidRefresh.current) {
      forbidRefresh.current = false;
      return null;
    }

    return loadChatInfo({
      appId,
      chatId,
      loading: appId !== chatData.appId
    });
  });

  useQuery(['loadHistory', appId], () => (appId ? loadHistory({ appId }) : null));

  useEffect(() => {
    setIdEmbed(window !== parent);
  }, []);

  return (
    // <Flex h={'100%'}>
    //   <Head>
    //     <title>{chatData.app.name}</title>
    //   </Head>
    //   {/* pc show myself apps */}
    //   {isPc && (
    //     <Box borderRight={theme.borders.base} w={'220px'} flexShrink={0}>
    //       <SliderApps appId={appId} />
    //     </Box>
    //   )}

    <PageContainer
      {...(isEmbed ? { p: '0 !important', borderRadius: '0' } : {})}
      bg={isPc ? '' : `url('/imgs/share_bg.png') no-repeat`}
    >
      <Head>
        <title>{chatData.app.name}</title>
      </Head>
      <Flex h={'100%'} flexDirection={['column', 'row']}>
        {/* pc always show history. */}
        {((children: React.ReactNode) => {
          return isPc || !appId ? (
            <SideBar>{children}</SideBar>
          ) : (
            <Drawer
              isOpen={isOpenSlider}
              placement="left"
              autoFocus={false}
              size={'xs'}
              onClose={onCloseSlider}
            >
              <DrawerOverlay backgroundColor={'rgba(255,255,255,0.5)'} />
              <DrawerContent maxWidth={'250px'}>{children}</DrawerContent>
            </Drawer>
          );
        })(
          <ChatHistorySlider
            appId={appId}
            appName={chatData.app.name}
            appAvatar={chatData.app.avatar}
            activeChatId={chatId}
            onClose={onCloseSlider}
            history={history.map((item, i) => ({
              id: item.chatId,
              title: item.title,
              customTitle: item.customTitle,
              top: item.top
            }))}
            onChangeChat={(chatId) => {
              router.replace({
                query: {
                  chatId: chatId || '',
                  appId,
                  shareId
                }
              });
              if (!isPc) {
                onCloseSlider();
              }
            }}
            onDelHistory={delHistory}
            onClearHistory={() => {
              clearHistory(appId);
              router.replace({
                query: {
                  appId
                }
              });
            }}
          />
        )}
        {/* chat container */}
        <Flex
          position={'relative'}
          h={[0, '100%']}
          w={['100%', 0]}
          flex={'1 0 0'}
          flexDirection={'column'}
          bg={isPc ? `url('/imgs/chat_bg.svg') no-repeat` : ''}
          backgroundPosition={'right'}
        >
          {/* header */}
          <ChatHeader
            appAvatar={chatData.app.avatar}
            appName={chatData.app.name}
            history={chatData.history}
            onOpenSlider={onOpenSlider}
          />

          {/* chat box */}
          <Box flex={1}>
            <ChatBox
              active={!!chatData.app.name}
              ref={ChatBoxRef}
              appAvatar={chatData.app.avatar}
              userAvatar={userInfo?.avatar}
              userGuideModule={chatData.app?.userGuideModule}
              feedbackType={'user'}
              onUpdateVariable={(e) => {}}
              onStartChat={startChat}
              onDelMessage={delOneHistoryItem}
              appId={appId}
            />
          </Box>
        </Flex>
      </Flex>
      <Loading fixed={false} />
    </PageContainer>
    // </Flex>
  );
};

export async function getServerSideProps(context: any) {
  const shareId = context?.query?.shareId || '';
  const chatId = context?.query?.chatId || '';
  const showHistory = context?.query?.showHistory || '1';
  const authToken = context?.query?.authToken || '';
  const appId = context?.query?.appId || '';
  return {
    props: {
      shareId,
      chatId,
      showHistory,
      authToken,
      appId,
      ...(await serviceSideProps(context))
    }
  };
}

export default Chat;
