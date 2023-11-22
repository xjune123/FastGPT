import { tokenInfo } from '@/web/common/system/staticData';
import { getToken } from '@/web/support/user/auth';

const get = (url: string) => {
  fetch(`${tokenInfo.base_url}${url}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  })
    .then((res) => {
      console.log(res, 'res');
      return res;
    })
    .catch((err) => {
      console.log(err, 'err');
    });
};

const post = (url: string, data: any) => {
  fetch(`${tokenInfo.base_url}${url}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
    .then((res) => {
      console.log(res, 'res');
      return res;
    })
    .catch((err) => {
      console.log(err, 'err');
    });
};

export default { get, post };
