import React from 'react';
import { useRouter } from 'next/router';
import { useToast } from '@chakra-ui/react';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useQuery } from '@tanstack/react-query';
import { getAccessToken } from '@/web/support/user/api';

const unAuthPage: { [key: string]: boolean } = {
  '/': true,
  '/login': true,
  '/login/provider': true,
  '/appStore': true
};

const Auth = ({ children }: { children: JSX.Element }) => {
  const router = useRouter();
  const toast = useToast({
    title: '请先登录',
    position: 'top',
    status: 'warning'
  });
  const { userInfo, initUserInfo } = useUserStore();

  useQuery(
    [router.pathname],
    () => {
      if (unAuthPage[router.pathname] === true || userInfo) {
        return null;
      } else {
        return initUserInfo();
      }
    },
    {
      onError(error) {
        if (location.pathname === '/chat_new1/share') {
          if (router.query.code) {
            getToken();
          } else {
            router.replace(
              `https://pkdc.pooksh.com:8080/oauth/oauth/authorize?response_type=code&client_id=pk-fastgpt&redirect_uri=${location.href}`
            );
          }
        } else {
          router.replace(
            `/login?lastRoute=${encodeURIComponent(location.pathname + location.search)}`
          );
          toast();
        }
      }
    }
  );

  const getToken = async () => {
    await getAccessToken({
      client_id: 'pk-fastgpt',
      client_secret: 'Pooksh888',
      grant_type: 'authorization_code',
      code: router.query.code,
      redirect_uri: location.href
    });
  };

  return userInfo || unAuthPage[router.pathname] === true ? children : null;
};

export default Auth;
