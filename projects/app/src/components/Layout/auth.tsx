import { useRouter } from 'next/router';
import { useToast } from '@chakra-ui/react';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useQuery } from '@tanstack/react-query';
import { getAccessToken } from '@/web/support/user/api';
import { tokenInfo } from '@/web/common/system/staticData';

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
            const redirect_uri = `${location.origin}${location.pathname}?shareId=${router.query.shareId}%26appId=${router.query.appId}`;
            router.replace(
              `${tokenInfo.auth_url}?response_type=code&client_id=${tokenInfo.client_id}&redirect_uri=${redirect_uri}`
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
    const redirect_uri = `${location.origin}${location.pathname}?shareId=${router.query.shareId}&appId=${router.query.appId}`;
    try {
      await getAccessToken({
        code: router.query.code,
        redirect_uri
      });
      window.location.href = redirect_uri;
    } catch (err) {
      console.log(err, 'err');
    }
  };

  return userInfo || unAuthPage[router.pathname] === true ? children : null;
};

export default Auth;
