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
            const redirect_uri = `${location.origin}${location.pathname}?shareId=${router.query.shareId}&appId=${router.query.appId}`;
            console.log(
              `${tokenInfo.auth_url}?response_type=code&client_id=${tokenInfo.client_id}&redirect_uri=${redirect_uri}`,
              'redirect_uri'
            );
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
    // console.log(redirect_uri, 'redirect_uri')
    await getAccessToken({
      code: router.query.code,
      redirect_uri
    });
    // router.reload();
  };

  return userInfo || unAuthPage[router.pathname] === true ? children : null;
};

export default Auth;
