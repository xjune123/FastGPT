import React, {
  useCallback,
  useRef,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  ForwardedRef,
  useEffect
} from 'react';
import Script from 'next/script';
import { throttle } from 'lodash';
import {
  ChatHistoryItemResType,
  ChatItemType,
  ChatSiteItemType,
  ExportChatType
} from '@/types/chat';
import { useToast } from '@/web/common/hooks/useToast';
import { useAudioPlay } from '@/web/common/utils/voice';
import { getErrText } from '@fastgpt/global/common/error/utils';
import { useCopyData } from '@/web/common/hooks/useCopyData';
import {
  Box,
  Card,
  Flex,
  Input,
  Textarea,
  Button,
  useTheme,
  BoxProps,
  FlexProps
} from '@chakra-ui/react';
import { feConfigs } from '@/web/common/system/staticData';
import { eventBus } from '@/web/common/utils/eventbus';
import { adaptChat2GptMessages } from '@/utils/common/adapt/message';
import { useMarkdown } from '@/web/common/hooks/useMarkdown';
import { AppModuleItemType } from '@/types/app';
import { VariableInputEnum } from '@/constants/app';
import { useForm } from 'react-hook-form';
import type { MessageItemType } from '@/types/core/chat/type';
import { fileDownload } from '@/web/common/file/utils';
import { htmlTemplate } from '@/constants/common';
import { useRouter } from 'next/router';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { TaskResponseKeyEnum } from '@/constants/chat';
import { useTranslation } from 'react-i18next';
import { customAlphabet } from 'nanoid';
import { adminUpdateChatFeedback, userUpdateChatFeedback } from '@/web/core/chat/api';
import type { AdminMarkType } from './SelectMarkCollection';
import { useUserStore } from '@/web/support/user/useUserStore';

import MyIcon from '@/components/Icon';
import Avatar from '@/components/Avatar';
import Markdown from '@/components/Markdown';
import MySelect from '@/components/Select';
import MyTooltip from '../MyTooltip';
import dynamic from 'next/dynamic';
const ResponseTags = dynamic(() => import('./ResponseTags'));
const FeedbackModal = dynamic(() => import('./FeedbackModal'));
const ReadFeedbackModal = dynamic(() => import('./ReadFeedbackModal'));
const SelectMarkCollection = dynamic(() => import('./SelectMarkCollection'));
const FileList = dynamic(() => import('./FileList'));

import styles from './index.module.scss';
import { postQuestionGuide } from '@/web/core/ai/api';
import { splitGuideModule } from '@/global/core/app/modules/utils';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz1234567890', 24);

const textareaMinH = '22px';

type generatingMessageProps = { text?: string; name?: string; status?: 'running' | 'finish' };

export type StartChatFnProps = {
  chatList: ChatSiteItemType[];
  messages: MessageItemType[];
  controller: AbortController;
  variables: Record<string, any>;
  generatingMessage: (e: generatingMessageProps) => void;
};

export type ComponentRef = {
  getChatHistory: () => ChatSiteItemType[];
  resetVariables: (data?: Record<string, any>) => void;
  resetHistory: (history: ChatSiteItemType[]) => void;
  scrollToBottom: (behavior?: 'smooth' | 'auto') => void;
};

enum FeedbackTypeEnum {
  user = 'user',
  admin = 'admin',
  hidden = 'hidden'
}

type Props = {
  appId: string;
  feedbackType?: `${FeedbackTypeEnum}`;
  showMarkIcon?: boolean; // admin mark dataset
  showVoiceIcon?: boolean;
  showEmptyIntro?: boolean;
  appAvatar?: string;
  userAvatar?: string;
  userGuideModule?: AppModuleItemType;
  active?: boolean;
  onUpdateVariable?: (e: Record<string, any>) => void;
  onStartChat?: (e: StartChatFnProps) => Promise<{
    responseText: string;
    [TaskResponseKeyEnum.responseData]: ChatHistoryItemResType[];
    isNewChat?: boolean;
  }>;
  onDelMessage?: (e: { contentId?: string; index: number }) => void;
};

const ChatBox = (
  {
    appId,
    feedbackType = FeedbackTypeEnum.hidden,
    showMarkIcon = false,
    showVoiceIcon = true,
    showEmptyIntro = false,
    appAvatar,
    userAvatar,
    userGuideModule,
    active = true,
    onUpdateVariable,
    onStartChat,
    onDelMessage
  }: Props,
  ref: ForwardedRef<ComponentRef>
) => {
  const ChatBoxRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isPc } = useSystemStore();
  const TextareaDom = useRef<HTMLTextAreaElement>(null);
  const chatController = useRef(new AbortController());
  const questionGuideController = useRef(new AbortController());
  const isNewChatReplace = useRef(false);

  const [refresh, setRefresh] = useState(false);
  const [variables, setVariables] = useState<Record<string, any>>({}); // settings variable
  const [chatHistory, setChatHistory] = useState<ChatSiteItemType[]>([]);
  const [feedbackId, setFeedbackId] = useState<string>();
  const [readFeedbackData, setReadFeedbackData] = useState<{
    // read feedback modal data
    chatItemId: string;
    content: string;
    isMarked: boolean;
  }>();
  const [adminMarkData, setAdminMarkData] = useState<AdminMarkType & { chatItemId: string }>();
  const [questionGuides, setQuestionGuide] = useState<string[]>([]);
  const { userInfo } = useUserStore();
  const isShare = useMemo(() => !appId || !userInfo, [appId, userInfo]);

  const isChatting = useMemo(
    () =>
      chatHistory[chatHistory.length - 1] &&
      chatHistory[chatHistory.length - 1]?.status !== 'finish',
    [chatHistory]
  );

  const { welcomeText, variableModules, questionGuide } = useMemo(
    () => splitGuideModule(userGuideModule),
    [userGuideModule]
  );

  // compute variable input is finish.
  const [variableInputFinish, setVariableInputFinish] = useState(false);
  const variableIsFinish = useMemo(() => {
    if (!variableModules || variableModules.length === 0 || chatHistory.length > 0) return true;

    for (let i = 0; i < variableModules.length; i++) {
      const item = variableModules[i];
      if (item.required && !variables[item.key]) {
        return false;
      }
    }

    return variableInputFinish;
  }, [chatHistory.length, variableInputFinish, variableModules, variables]);

  const { register, reset, getValues, setValue, handleSubmit } = useForm<Record<string, any>>({
    defaultValues: variables
  });

  // 滚动到底部
  const scrollToBottom = useCallback(
    (behavior: 'smooth' | 'auto' = 'smooth') => {
      if (!ChatBoxRef.current) return;
      ChatBoxRef.current.scrollTo({
        top: ChatBoxRef.current.scrollHeight,
        behavior
      });
    },
    [ChatBoxRef]
  );
  // 聊天信息生成中……获取当前滚动条位置，判断是否需要滚动到底部
  const generatingScroll = useCallback(
    throttle(() => {
      if (!ChatBoxRef.current) return;
      const isBottom =
        ChatBoxRef.current.scrollTop + ChatBoxRef.current.clientHeight + 150 >=
        ChatBoxRef.current.scrollHeight;

      isBottom && scrollToBottom('auto');
    }, 100),
    []
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const generatingMessage = useCallback(
    // concat text to end of message
    ({ text = '', status, name }: generatingMessageProps) => {
      setChatHistory((state) =>
        state.map((item, index) => {
          if (index !== state.length - 1) return item;
          return {
            ...item,
            ...(text
              ? {
                  value: item.value + text
                }
              : {}),
            ...(status && name
              ? {
                  status,
                  moduleName: name
                }
              : {})
          };
        })
      );
      generatingScroll();
    },
    [generatingScroll, setChatHistory]
  );

  // 重置输入内容
  const resetInputVal = useCallback((val: string) => {
    if (!TextareaDom.current) return;

    setTimeout(() => {
      /* 回到最小高度 */
      if (TextareaDom.current) {
        TextareaDom.current.value = val;
        TextareaDom.current.style.height =
          val === '' ? textareaMinH : `${TextareaDom.current.scrollHeight}px`;
      }
    }, 100);
  }, []);

  // create question guide
  const createQuestionGuide = useCallback(
    async ({ history }: { history: ChatSiteItemType[] }) => {
      if (!questionGuide || chatController.current?.signal?.aborted) return;

      try {
        const abortSignal = new AbortController();
        questionGuideController.current = abortSignal;

        const result = await postQuestionGuide(
          {
            messages: adaptChat2GptMessages({ messages: history, reserveId: false }).slice(-6),
            shareId: router.query.shareId as string
          },
          abortSignal
        );
        if (Array.isArray(result)) {
          setQuestionGuide(result);
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }
      } catch (error) {}
    },
    [questionGuide, scrollToBottom, router.query.shareId]
  );

  /**
   * user confirm send prompt
   */
  const sendPrompt = useCallback(
    async (variables: Record<string, any> = {}, inputVal = '', history = chatHistory) => {
      if (!onStartChat) return;
      if (isChatting) {
        toast({
          title: '正在聊天中...请等待结束',
          status: 'warning'
        });
        return;
      }
      questionGuideController.current?.abort('stop');
      // get input value
      const val = inputVal.trim();

      if (!val) {
        toast({
          title: '内容为空',
          status: 'warning'
        });
        return;
      }

      const newChatList: ChatSiteItemType[] = [
        ...history,
        {
          dataId: nanoid(),
          obj: 'Human',
          value: val,
          status: 'finish'
        },
        {
          dataId: nanoid(),
          obj: 'AI',
          value: '',
          status: 'loading'
        }
      ];

      // 插入内容
      setChatHistory(newChatList);

      // 清空输入内容
      resetInputVal('');
      setQuestionGuide([]);
      setTimeout(() => {
        scrollToBottom();
      }, 100);

      try {
        // create abort obj
        const abortSignal = new AbortController();
        chatController.current = abortSignal;

        const messages = adaptChat2GptMessages({ messages: newChatList, reserveId: true });

        const {
          responseData,
          responseText,
          isNewChat = false
        } = await onStartChat({
          chatList: newChatList,
          messages,
          controller: abortSignal,
          generatingMessage,
          variables
        });

        isNewChatReplace.current = isNewChat;

        // set finish status
        setChatHistory((state) =>
          state.map((item, index) => {
            if (index !== state.length - 1) return item;
            return {
              ...item,
              status: 'finish',
              responseData
            };
          })
        );

        setTimeout(() => {
          createQuestionGuide({
            history: newChatList.map((item, i) =>
              i === newChatList.length - 1
                ? {
                    ...item,
                    value: responseText
                  }
                : item
            )
          });
          generatingScroll();
          isPc && TextareaDom.current?.focus();
        }, 100);
      } catch (err: any) {
        toast({
          title: getErrText(err, '聊天出错了~'),
          status: 'error',
          duration: 5000,
          isClosable: true
        });

        if (!err?.responseText) {
          resetInputVal(inputVal);
          setChatHistory(newChatList.slice(0, newChatList.length - 2));
        }

        // set finish status
        setChatHistory((state) =>
          state.map((item, index) => {
            if (index !== state.length - 1) return item;
            return {
              ...item,
              status: 'finish'
            };
          })
        );
      }
    },
    [
      chatHistory,
      onStartChat,
      isChatting,
      resetInputVal,
      toast,
      scrollToBottom,
      generatingMessage,
      createQuestionGuide,
      generatingScroll,
      isPc
    ]
  );

  // retry input
  const retryInput = useCallback(
    async (index: number) => {
      if (!onDelMessage) return;
      const delHistory = chatHistory.slice(index);
      setChatHistory((state) => (index === 0 ? [] : state.slice(0, index)));

      await Promise.all(
        delHistory.map((item, i) => onDelMessage({ contentId: item.dataId, index: index + i }))
      );

      sendPrompt(variables, delHistory[0].value, chatHistory.slice(0, index));
    },
    [chatHistory, onDelMessage, sendPrompt, variables]
  );
  // delete one message
  const delOneMessage = useCallback(
    ({ dataId, index }: { dataId?: string; index: number }) => {
      setChatHistory((state) => state.filter((chat) => chat.dataId !== dataId));
      onDelMessage?.({
        contentId: dataId,
        index
      });
    },
    [onDelMessage]
  );

  // output data
  useImperativeHandle(ref, () => ({
    getChatHistory: () => chatHistory,
    resetVariables(e) {
      const defaultVal: Record<string, any> = {};
      variableModules?.forEach((item) => {
        defaultVal[item.key] = '';
      });

      reset(e || defaultVal);
      setVariables(e || defaultVal);
    },
    resetHistory(e) {
      setVariableInputFinish(!!e.length);
      setChatHistory(e);
    },
    scrollToBottom
  }));

  /* style start */
  const MessageCardStyle: BoxProps = {
    px: 4,
    py: 3,
    borderRadius: '0 8px 8px 8px',
    boxShadow: 'none',
    display: 'inline-block',
    maxW: ['calc(100% - 25px)', 'calc(100% - 40px)']
  };

  const showEmpty = useMemo(
    () =>
      feConfigs?.show_emptyChat &&
      showEmptyIntro &&
      chatHistory.length === 0 &&
      !variableModules?.length &&
      !welcomeText,
    [chatHistory.length, showEmptyIntro, variableModules, welcomeText]
  );
  const statusBoxData = useMemo(() => {
    const colorMap = {
      loading: 'myGray.700',
      running: '#67c13b',
      finish: 'myBlue.600'
    };
    if (!isChatting) return;
    const chatContent = chatHistory[chatHistory.length - 1];
    if (!chatContent) return;

    return {
      bg: colorMap[chatContent.status] || colorMap.loading,
      name: t(chatContent.moduleName || 'Running')
    };
  }, [chatHistory, isChatting, t]);
  /* style end */

  // page change and abort request
  useEffect(() => {
    isNewChatReplace.current = false;
    return () => {
      chatController.current?.abort('leave');
      if (!isNewChatReplace.current) {
        questionGuideController.current?.abort('leave');
      }
    };
  }, [router.query]);

  // add guide text listener
  useEffect(() => {
    const windowMessage = ({ data }: MessageEvent<{ type: 'sendPrompt'; text: string }>) => {
      if (data?.type === 'sendPrompt' && data?.text) {
        handleSubmit((item) => sendPrompt(item, data.text))();
      }
    };
    window.addEventListener('message', windowMessage);
    eventBus.on('guideClick', ({ text }: { text: string }) => {
      if (!text) return;
      handleSubmit((data) => sendPrompt(data, text))();
    });

    return () => {
      eventBus.off('guideClick');
      window.removeEventListener('message', windowMessage);
    };
  }, [handleSubmit, sendPrompt]);

  return (
    <Flex flexDirection={'column'} h={'100%'}>
      <Script src="/js/html2pdf.bundle.min.js" strategy="lazyOnload"></Script>

      {/* chat box container */}
      <Box ref={ChatBoxRef} flex={'1 0 0'} h={0} w={'100%'} overflow={'overlay'} px={[4, 0]} pb={3}>
        <Box id="chat-container" maxW={['auto', 'min(750px, 100%)']} h={'100%'} mx={'auto'}>
          {showEmpty && <Empty />}

          {!!welcomeText && (
            <Box py={3} display={'flex'}>
              {/* avatar */}
              <ChatAvatar src={appAvatar} type={'AI'} />
              {/* message */}
              <Box textAlign={'left'} ml={2}>
                <Card order={2} {...MessageCardStyle} bg={isPc ? '#F6F6F6' : '#fff'}>
                  <Markdown source={`~~~guide \n${welcomeText}`} isChatting={false} />
                </Card>
              </Box>
            </Box>
          )}
          {/* variable input */}
          {!!variableModules?.length && (
            <Box py={3}>
              {/* avatar */}
              <ChatAvatar src={appAvatar} type={'AI'} />
              {/* message */}
              <Box textAlign={'left'}>
                <Card
                  order={2}
                  mt={2}
                  bg={isPc ? '#F6F6F6' : '#fff'}
                  w={'400px'}
                  {...MessageCardStyle}
                >
                  {variableModules.map((item) => (
                    <Box key={item.id} mb={4}>
                      <VariableLabel required={item.required}>{item.label}</VariableLabel>
                      {item.type === VariableInputEnum.input && (
                        <Input
                          isDisabled={variableIsFinish}
                          {...register(item.key, {
                            required: item.required
                          })}
                        />
                      )}
                      {item.type === VariableInputEnum.select && (
                        <MySelect
                          width={'100%'}
                          isDisabled={variableIsFinish}
                          list={(item.enums || []).map((item) => ({
                            label: item.value,
                            value: item.value
                          }))}
                          {...register(item.key, {
                            required: item.required
                          })}
                          value={getValues(item.key)}
                          onchange={(e) => {
                            setValue(item.key, e);
                            setRefresh(!refresh);
                          }}
                        />
                      )}
                    </Box>
                  ))}
                  {!variableIsFinish && (
                    <Button
                      leftIcon={<MyIcon name={'chatFill'} w={'16px'} />}
                      size={'sm'}
                      maxW={'100px'}
                      borderRadius={'lg'}
                      onClick={handleSubmit((data) => {
                        onUpdateVariable?.(data);
                        setVariables(data);
                        setVariableInputFinish(true);
                      })}
                    >
                      {'开始对话'}
                    </Button>
                  )}
                </Card>
              </Box>
            </Box>
          )}

          {/* chat history */}
          <Box id={'history'}>
            {chatHistory.map((item, index) => (
              <Box
                key={item.dataId}
                flexDirection={'column'}
                alignItems={item.obj === 'Human' ? 'flex-end' : 'flex-start'}
                py={5}
              >
                {item.obj === 'Human' && (
                  <Flex justifyContent={'flex-end'}>
                    {/* content */}
                    <Box mr={['6px', 2]} flex={'1'} textAlign={'right'}>
                      <Card
                        className="markdown"
                        whiteSpace={'pre-wrap'}
                        {...MessageCardStyle}
                        px={0}
                        py={0}
                        boxShadow={'none'}
                        bg={'none'}
                        color={'#fff'}
                        textAlign={'left'}
                      >
                        <Box as={'p'} bg={'myBlue.1100'} borderRadius={'16px'} padding={3}>
                          {item.value}
                        </Box>
                        <ChatController
                          chat={item}
                          // onDelete={
                          //   onDelMessage
                          //     ? () => {
                          //       delOneMessage({ dataId: item.dataId, index });
                          //     }
                          //     : undefined
                          // }
                          onRetry={() => retryInput(index)}
                        />
                      </Card>
                    </Box>
                    {/* control icon */}
                    <Flex>
                      <ChatAvatar src={userAvatar} type={'Human'} />
                    </Flex>
                  </Flex>
                )}
                {item.obj === 'AI' && (
                  <Flex w={'100%'} alignItems={'flex-start'}>
                    {/* control icon */}
                    <Flex mr={1}>
                      <ChatAvatar src={appAvatar} type={'AI'} />
                      {/* chatting status */}
                      {statusBoxData && index === chatHistory.length - 1 && (
                        <Flex
                          alignItems={'center'}
                          px={3}
                          py={'1px'}
                          borderRadius="md"
                          border={theme.borders.base}
                        >
                          <Box
                            className={styles.statusAnimation}
                            bg={statusBoxData.bg}
                            w="8px"
                            h="8px"
                            borderRadius={'50%'}
                            mt={'1px'}
                          ></Box>
                          <Box ml={2} color={'myGray.600'} whiteSpace={'nowrap'}>
                            {statusBoxData.name}
                          </Box>
                        </Flex>
                      )}
                    </Flex>
                    {/* content */}
                    <Box textAlign={'left'}>
                      <Card
                        bg={isPc ? '#F6F6F6' : '#fff'}
                        {...MessageCardStyle}
                        minW={isPc ? '430px' : '230px'}
                      >
                        <Markdown
                          source={item.value}
                          isChatting={index === chatHistory.length - 1 && isChatting}
                        />
                        <Flex justifyContent={'space-between'}>
                          <ResponseTags responseData={item.responseData} />
                          <ChatController
                            ml={2}
                            chat={item}
                            display={
                              index === chatHistory.length - 1 && isChatting ? 'none' : 'flex'
                            }
                            onReadFeedback={
                              feedbackType === FeedbackTypeEnum.admin
                                ? () =>
                                    setReadFeedbackData({
                                      chatItemId: item.dataId || '',
                                      content: item.userFeedback || '',
                                      isMarked: !!item.adminFeedback
                                    })
                                : undefined
                            }
                            onFeedback={
                              feedbackType === FeedbackTypeEnum.user
                                ? item.userFeedback
                                  ? () => {
                                      if (!item.dataId) return;
                                      setChatHistory((state) =>
                                        state.map((chatItem) =>
                                          chatItem.dataId === item.dataId
                                            ? { ...chatItem, userFeedback: undefined }
                                            : chatItem
                                        )
                                      );
                                      try {
                                        userUpdateChatFeedback({ chatItemId: item.dataId });
                                      } catch (error) {}
                                    }
                                  : () => setFeedbackId(item.dataId)
                                : undefined
                            }
                          />
                        </Flex>
                        <FileList responseData={item.responseData} />
                        {/* question guide */}
                        {index === chatHistory.length - 1 &&
                          !isChatting &&
                          questionGuides.length > 0 && (
                            <Flex
                              mt={2}
                              borderTop={theme.borders.sm}
                              alignItems={'center'}
                              flexWrap={'wrap'}
                            >
                              <Box
                                color={'myGray.500'}
                                mt={2}
                                mr={2}
                                fontSize={'sm'}
                                fontStyle={'italic'}
                              >
                                {t('chat.Question Guide Tips')}
                              </Box>
                              {questionGuides.map((item) => (
                                <Button
                                  mt={2}
                                  key={item}
                                  mr="2"
                                  borderRadius={'md'}
                                  variant={'outline'}
                                  colorScheme={'gray'}
                                  size={'xs'}
                                  onClick={() => {
                                    resetInputVal(item);
                                  }}
                                >
                                  {item}
                                </Button>
                              ))}
                            </Flex>
                          )}
                        {/* admin mark content */}
                        {showMarkIcon && item.adminFeedback && (
                          <Box>
                            <Flex alignItems={'center'} py={2}>
                              <MyIcon name={'markLight'} w={'14px'} color={'myGray.900'} />
                              <Box ml={2} color={'myGray.500'}>
                                {t('chat.Admin Mark Content')}
                              </Box>
                              <Box h={'1px'} bg={'myGray.300'} flex={'1'} />
                            </Flex>
                            <Box whiteSpace={'pre'}>{`${item.adminFeedback.q || ''}${
                              item.adminFeedback.a ? `\n${item.adminFeedback.a}` : ''
                            }`}</Box>
                          </Box>
                        )}
                      </Card>
                    </Box>
                  </Flex>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      {/* message input */}
      {onStartChat && variableIsFinish && active ? (
        <Box m={['0 auto', '10px auto']} w={'100%'} maxW={['auto', 'min(750px, 100%)']} px={[0, 5]}>
          <Box
            py={isPc ? '18px' : '10px'}
            position={'relative'}
            // boxShadow={`0 0 10px rgba(0,0,0,0.2)`}
            border={'1px solid'}
            borderColor={isPc ? '#E5E5E5 !important' : '#FFF !important'}
            borderRadius={21}
            backgroundColor={'white'}
            margin={'10px'}
          >
            {/* 输入框 */}
            <Textarea
              ref={TextareaDom}
              py={0}
              pr={['45px', '55px']}
              border={'none'}
              _focusVisible={{
                border: 'none'
              }}
              placeholder="请输入提问信息..."
              resize={'none'}
              rows={1}
              height={'22px'}
              lineHeight={'22px'}
              maxHeight={'150px'}
              maxLength={-1}
              overflowY={'auto'}
              whiteSpace={'pre-wrap'}
              wordBreak={'break-all'}
              boxShadow={'none !important'}
              color={'myGray.900'}
              onChange={(e) => {
                const textarea = e.target;
                textarea.style.height = textareaMinH;
                textarea.style.height = `${textarea.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                // enter send.(pc or iframe && enter and unPress shift)
                if ((isPc || window !== parent) && e.keyCode === 13 && !e.shiftKey) {
                  handleSubmit((data) => sendPrompt(data, TextareaDom.current?.value))();
                  e.preventDefault();
                }
                // 全选内容
                // @ts-ignore
                e.key === 'a' && e.ctrlKey && e.target?.select();
              }}
            />
            {/* 发送和等待按键 */}
            <Flex
              alignItems={'center'}
              justifyContent={'center'}
              h={'25px'}
              w={'25px'}
              position={'absolute'}
              right={['12px', '20px']}
              bottom={isPc ? '15px' : '9px'}
            >
              {isChatting ? (
                <MyIcon
                  className={styles.stopIcon}
                  width={['22px', '25px']}
                  height={['22px', '25px']}
                  cursor={'pointer'}
                  name={'stop'}
                  color={'gray.500'}
                  onClick={() => chatController.current?.abort('stop')}
                />
              ) : (
                <MyIcon
                  name={'send'}
                  width={['32px', '32px']}
                  height={['32px', '32px']}
                  cursor={'pointer'}
                  color={'gray.500'}
                  onClick={() => {
                    handleSubmit((data) => sendPrompt(data, TextareaDom.current?.value))();
                  }}
                />
              )}
            </Flex>
          </Box>
        </Box>
      ) : null}

      {/* user feedback modal */}
      {!!feedbackId && (
        <FeedbackModal
          chatItemId={feedbackId}
          onClose={() => setFeedbackId(undefined)}
          onSuccess={(content: string) => {
            setChatHistory((state) =>
              state.map((item) =>
                item.dataId === feedbackId ? { ...item, userFeedback: content } : item
              )
            );
            setFeedbackId(undefined);
          }}
        />
      )}
      {/* admin read feedback modal */}
      {!!readFeedbackData && (
        <ReadFeedbackModal
          {...readFeedbackData}
          onClose={() => setReadFeedbackData(undefined)}
          onMark={() => {
            const index = chatHistory.findIndex(
              (item) => item.dataId === readFeedbackData.chatItemId
            );
            if (index === -1) return setReadFeedbackData(undefined);
            setAdminMarkData({
              chatItemId: readFeedbackData.chatItemId,
              q: chatHistory[index - 1]?.value || '',
              a: chatHistory[index]?.value || ''
            });
          }}
          onSuccess={() => {
            setChatHistory((state) =>
              state.map((chatItem) =>
                chatItem.dataId === readFeedbackData.chatItemId
                  ? { ...chatItem, userFeedback: undefined }
                  : chatItem
              )
            );
            setReadFeedbackData(undefined);
          }}
        />
      )}
      {/* admin mark data */}
      {!!adminMarkData && (
        <SelectMarkCollection
          adminMarkData={adminMarkData}
          setAdminMarkData={(e) => setAdminMarkData({ ...e, chatItemId: adminMarkData.chatItemId })}
          onClose={() => setAdminMarkData(undefined)}
          onSuccess={(adminFeedback) => {
            adminUpdateChatFeedback({
              chatItemId: adminMarkData.chatItemId,
              ...adminFeedback
            });
            // update dom
            setChatHistory((state) =>
              state.map((chatItem) =>
                chatItem.dataId === adminMarkData.chatItemId
                  ? {
                      ...chatItem,
                      adminFeedback
                    }
                  : chatItem
              )
            );

            if (readFeedbackData) {
              userUpdateChatFeedback({
                chatItemId: readFeedbackData.chatItemId,
                userFeedback: undefined
              });
              setChatHistory((state) =>
                state.map((chatItem) =>
                  chatItem.dataId === readFeedbackData.chatItemId
                    ? { ...chatItem, userFeedback: undefined }
                    : chatItem
                )
              );
              setReadFeedbackData(undefined);
            }
          }}
        />
      )}
    </Flex>
  );
};

export default React.memo(forwardRef(ChatBox));

export const useChatBox = () => {
  const onExportChat = useCallback(
    ({ type, history }: { type: ExportChatType; history: ChatItemType[] }) => {
      const getHistoryHtml = () => {
        const historyDom = document.getElementById('history');
        if (!historyDom) return;
        const dom = Array.from(historyDom.children).map((child, i) => {
          const avatar = `<img src="${child.querySelector<HTMLImageElement>('.avatar')
            ?.src}" alt="" />`;

          const chatContent = child.querySelector<HTMLDivElement>('.markdown');

          if (!chatContent) {
            return '';
          }

          const chatContentClone = chatContent.cloneNode(true) as HTMLDivElement;

          const codeHeader = chatContentClone.querySelectorAll('.code-header');
          codeHeader.forEach((childElement: any) => {
            childElement.remove();
          });

          return `<div class="chat-item">
          ${avatar}
          ${chatContentClone.outerHTML}
        </div>`;
        });

        const html = htmlTemplate.replace('{{CHAT_CONTENT}}', dom.join('\n'));
        return html;
      };

      const map: Record<ExportChatType, () => void> = {
        md: () => {
          fileDownload({
            text: history.map((item) => item.value).join('\n\n'),
            type: 'text/markdown',
            filename: 'chat.md'
          });
        },
        html: () => {
          const html = getHistoryHtml();
          html &&
            fileDownload({
              text: html,
              type: 'text/html',
              filename: '聊天记录.html'
            });
        },
        pdf: () => {
          const html = getHistoryHtml();

          html &&
            // @ts-ignore
            html2pdf(html, {
              margin: 0,
              filename: `聊天记录.pdf`
            });
        }
      };

      map[type]();
    },
    []
  );

  return {
    onExportChat
  };
};

function VariableLabel({
  required = false,
  children
}: {
  required?: boolean;
  children: React.ReactNode | string;
}) {
  return (
    <Box as={'label'} display={'inline-block'} position={'relative'} mb={1}>
      {children}
      {required && (
        <Box
          position={'absolute'}
          top={'-2px'}
          right={'-10px'}
          color={'red.500'}
          fontWeight={'bold'}
        >
          *
        </Box>
      )}
    </Box>
  );
}
function ChatAvatar({ src, type }: { src?: string; type: 'Human' | 'AI' }) {
  const theme = useTheme();
  return (
    <Box
      w={['28px', '34px']}
      h={['28px', '34px']}
      // p={'2px'}
      borderRadius={'lg'}
      border={theme.borders.base}
      boxShadow={'0 0 5px rgba(0,0,0,0.1)'}
      bg={type === 'Human' ? 'white' : 'myBlue.100'}
    >
      <Avatar src={src} w={'100%'} h={'100%'} />
    </Box>
  );
}

function Empty() {
  const { data: chatProblem } = useMarkdown({ url: '/chatProblem.md' });
  const { data: versionIntro } = useMarkdown({ url: '/versionIntro.md' });

  return (
    <Box pt={6} w={'85%'} maxW={'600px'} m={'auto'} alignItems={'center'} justifyContent={'center'}>
      {/* version intro */}
      <Card p={4} mb={10} minH={'200px'}>
        <Markdown source={versionIntro} />
      </Card>
      <Card p={4} minH={'600px'}>
        <Markdown source={chatProblem} />
      </Card>
    </Box>
  );
}

function ChatController({
  chat,
  display,
  showVoiceIcon,
  onReadFeedback,
  onMark,
  onRetry,
  onDelete,
  onFeedback,
  ml,
  mr
}: {
  chat: ChatSiteItemType;
  showVoiceIcon?: boolean;
  onRetry?: () => void;
  onDelete?: () => void;
  onMark?: () => void;
  onReadFeedback?: () => void;
  onFeedback?: () => void;
} & FlexProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { copyData } = useCopyData();
  const { audioLoading, audioPlaying, hasAudio, playAudio, cancelAudio } = useAudioPlay({});
  const controlIconStyle = {
    cursor: 'pointer',
    p: 1
    // color: '#999999',
    // borderRadius: 'lg',
    // boxShadow: '0 0 5px rgba(0,0,0,0.1)',
    // border: theme.borders.base,
    // mr: 1，
  };
  const controlContainerStyle = {
    className: 'control',
    display: 'flex',
    pl: 1,
    cursor: 'pointer',
    mt: 3,
    justifyContent: 'end',
    color: '#999999',
    flex: '1'
  };

  return (
    <Flex {...controlContainerStyle} ml={ml} mr={mr} display={display}>
      <MyTooltip label={'复制'}>
        <Box
          mr={3}
          display={'flex'}
          alignItems={'center'}
          _hover={{ color: '#3B6EFF' }}
          onClick={() => copyData(chat.value)}
        >
          <MyIcon {...controlIconStyle} name={'copy_white'} _hover={{ color: '#3B6EFF' }} />
          <Box whiteSpace={'nowrap'}>复制</Box>
        </Box>
      </MyTooltip>
      {!!onDelete && (
        <>
          {onRetry && (
            <MyTooltip label={t('chat.retry')}>
              <MyIcon
                {...controlIconStyle}
                name={'retryLight'}
                _hover={{ color: 'green.500' }}
                onClick={onRetry}
              />
            </MyTooltip>
          )}
          <MyTooltip label={'删除'}>
            <MyIcon
              {...controlIconStyle}
              name={'delete'}
              _hover={{ color: 'red.600' }}
              onClick={onDelete}
            />
          </MyTooltip>
        </>
      )}
      {showVoiceIcon &&
        hasAudio &&
        (audioLoading ? (
          <MyTooltip label={'加载中...'}>
            <MyIcon {...controlIconStyle} name={'loading'} />
          </MyTooltip>
        ) : audioPlaying ? (
          <MyTooltip label={'终止播放'}>
            <MyIcon
              {...controlIconStyle}
              name={'pause'}
              _hover={{ color: '#E74694' }}
              onClick={() => cancelAudio()}
            />
          </MyTooltip>
        ) : (
          <MyTooltip label={'语音播报'}>
            <MyIcon
              {...controlIconStyle}
              name={'voice'}
              _hover={{ color: '#E74694' }}
              onClick={() => playAudio(chat.value)}
            />
          </MyTooltip>
        ))}
      {!!onMark && (
        <MyTooltip label={t('chat.Mark')}>
          <MyIcon
            {...controlIconStyle}
            name={'markLight'}
            _hover={{ color: '#67c13b' }}
            onClick={onMark}
          />
        </MyTooltip>
      )}
      {!!onReadFeedback && (
        <MyTooltip label={t('chat.Read User Feedback')}>
          <MyIcon
            display={chat.userFeedback ? 'block' : 'none'}
            {...controlIconStyle}
            color={'white'}
            bg={'#FC9663'}
            fontWeight={'bold'}
            name={'badLight'}
          />
        </MyTooltip>
      )}
      {!!onFeedback && (
        <MyTooltip
          label={
            chat.userFeedback
              ? `取消反馈。\n您当前反馈内容为:\n${
                  chat.userFeedback === 'N/A' ? '' : chat.userFeedback
                }`
              : '反馈'
          }
        >
          <Box
            {...(!!chat.userFeedback
              ? {
                  // bg: '#FC9663',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  onClick: onFeedback
                }
              : {
                  _hover: { color: '#3B6EFF' },
                  display: 'flex',
                  alignItems: 'center',
                  onClick: onFeedback
                })}
          >
            <MyIcon
              {...controlIconStyle}
              name={chat.userFeedback ? 'bad1' : 'bad2'}
              _hover={{ color: '#3B6EFF' }}
            />
            <Box whiteSpace={'nowrap'}>{chat.userFeedback ? '' : '反馈'}</Box>
          </Box>
        </MyTooltip>
      )}
    </Flex>
  );
}
