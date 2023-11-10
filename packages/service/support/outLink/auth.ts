import { AuthUserTypeEnum, authBalanceByUid, authJWT } from '../user/auth';
import { MongoOutLink } from './schema';
import { POST } from '../../common/api/plusRequest';
import { OutLinkSchema } from '@fastgpt/global/support/outLink/type';
import { NextApiRequest } from 'next';
import Cookie from 'cookie';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';

export type AuthLinkProps = {
  ip?: string | null;
  authToken?: string;
  question: string;
  pathName: String;
};
export type AuthLinkLimitProps = AuthLinkProps & { outLink: OutLinkSchema };

export async function authOutLinkChat({
  shareId,
  ip,
  authToken,
  question,
  req,
  pathName
}: AuthLinkProps & {
  shareId: string;
  req: NextApiRequest;
}) {
  // get outLink
  let outLink = await MongoOutLink.findOne({
    shareId
  });

  if (!outLink) {
    return Promise.reject('分享链接无效');
  }

  const { cookie } = req.headers || {};
  const uid = await authCookieToken(cookie, '');

  const [user] = await Promise.all([
    authBalanceByUid(uid), // authBalance
    ...(global.feConfigs?.isPlus
      ? [authOutLinkLimit({ outLink, ip, authToken, question, pathName })]
      : []) // limit auth
  ]);

  return {
    user,
    userId: uid,
    appId: String(outLink.appId),
    authType: AuthUserTypeEnum.token,
    responseDetail: outLink.responseDetail
  };
}
const authCookieToken = async (cookie?: string, token?: string): Promise<string> => {
  // 获取 cookie
  const cookies = Cookie.parse(cookie || '');
  const cookieToken = cookies.token || token;

  if (!cookieToken) {
    return Promise.reject(ERROR_ENUM.unAuthorization);
  }

  return await authJWT(cookieToken);
};
export function authOutLinkLimit(data: AuthLinkLimitProps) {
  return POST('/support/outLink/authLimit', data);
}

export async function authOutLinkId({ id }: { id: string }) {
  const outLink = await MongoOutLink.findOne({
    shareId: id
  });

  if (!outLink) {
    return Promise.reject('分享链接无效');
  }

  return {
    userId: String(outLink.userId)
  };
}

export type AuthShareChatInitProps = {
  authToken?: string;
  tokenUrl?: string;
};

export function authShareChatInit(data: AuthShareChatInitProps) {
  if (!global.feConfigs?.isPlus) return;
  return POST('/support/outLink/authShareChatInit', data);
}
