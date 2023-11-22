import React, { useMemo } from 'react';
import { Flex, Box, IconButton } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import MyIcon from '@/components/Icon';
import Avatar from '@/components/Avatar';

const SliderApps = ({ appId, callback }: { callback: Function; appId: string }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { myNewApps, loadMyNewApps } = useUserStore();
  const isShare = useMemo(() => router.pathname === '/chat_new1/share', [router.pathname]);

  useQuery(['loadModels'], () => loadMyNewApps(false));

  return (
    <Flex flexDirection={'column'} h={'100%'}>
      {!isShare && (
        <Box px={5} py={4}>
          <Flex
            alignItems={'center'}
            cursor={'pointer'}
            py={2}
            px={3}
            borderRadius={'md'}
            _hover={{ bg: 'myGray.200' }}
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
        </Box>
      )}
      <Box px={5} overflow={'overlay'}>
        {myNewApps.map((item) => (
          <Flex
            key={item._id}
            py={2}
            px={3}
            mb={3}
            cursor={'pointer'}
            borderRadius={'lg'}
            alignItems={'center'}
            {...(item._id === appId
              ? {
                  bg: 'white',
                  boxShadow: 'md'
                }
              : {
                  _hover: {
                    bg: 'myGray.200'
                  },
                  onClick: () => {
                    router.replace({
                      query: {
                        appId: item._id
                      }
                    });
                    callback && callback();
                  }
                })}
          >
            <Avatar src={item.avatar} w={'24px'} />
            <Box ml={2} className={'textEllipsis'}>
              {item.name}
            </Box>
          </Flex>
        ))}
      </Box>
    </Flex>
  );
};

export default SliderApps;
